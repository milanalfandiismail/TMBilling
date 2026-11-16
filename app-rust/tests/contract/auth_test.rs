//! Kontrak auth: login, throttle, RBAC, CSRF, dan guard hapus user.

use axum::body::Body;
use axum::extract::ConnectInfo;
use axum::http::{HeaderMap, Request, StatusCode};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use tmbilling_server::app::router;
use tmbilling_server::config::Config;
use tmbilling_server::models::user::hash_password;
use tmbilling_server::repositories::settings as settings_repo;
use tmbilling_server::state::AppState;
use tower::ServiceExt;

const LAN: SocketAddr = SocketAddr::new(std::net::IpAddr::V4(std::net::Ipv4Addr::new(192, 168, 1, 50)), 5000);

struct TempDir(PathBuf);

impl TempDir {
    fn new(tag: &str) -> Self {
        let mut path = std::env::temp_dir();
        path.push(format!("tm_auth_{tag}_{}_{}", std::process::id(), std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        std::fs::create_dir_all(&path).unwrap();
        Self(path)
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

async fn state(tag: &str) -> (TempDir, Arc<AppState>) {
    let dir = TempDir::new(tag);
    let cfg = Config::load(&dir.0).unwrap();
    let st = Arc::new(AppState::new(cfg).await.unwrap());
    settings_repo::set(&st.pool, "ip_whitelist_enabled", "false").await.unwrap();
    sqlx::query("UPDATE user SET password_hash = ? WHERE username = 'admin'")
        .bind(hash_password("rahasia123"))
        .execute(&st.pool)
        .await
        .unwrap();
    (dir, st)
}

async fn add_user(st: &AppState, username: &str, role: &str) {
    sqlx::query(
        "INSERT INTO user (username, password_hash, nama_lengkap, role, aktif, kuota_main_bulanan, sisa_kuota_menit) \
         VALUES (?, ?, ?, ?, 1, 0, 0)",
    )
    .bind(username)
    .bind(hash_password("rahasia123"))
    .bind(username)
    .bind(role)
    .execute(&st.pool)
    .await
    .unwrap();
}

struct Reply {
    status: StatusCode,
    headers: HeaderMap,
    body: String,
}

fn cookie_of(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get_all("set-cookie")
        .iter()
        .filter_map(|v| v.to_str().ok())
        .find(|c| c.starts_with(&format!("{name}=")))
        .and_then(|c| c.split(';').next())
        .map(|c| c.split_once('=').map(|(_, v)| v.to_string()).unwrap_or_default())
}

async fn send(st: Arc<AppState>, method: &str, uri: &str, cookies: &str, csrf: Option<&str>, body: Option<Value>) -> Reply {
    let mut builder = Request::builder().method(method).uri(uri);
    if !cookies.is_empty() {
        builder = builder.header("cookie", cookies);
    }
    if let Some(token) = csrf {
        builder = builder.header("x-csrftoken", token);
    }
    let payload = match body {
        Some(v) => {
            builder = builder.header("content-type", "application/json");
            serde_json::to_vec(&v).unwrap()
        }
        None => Vec::new(),
    };
    let mut req = builder.body(Body::from(payload)).unwrap();
    req.extensions_mut().insert(ConnectInfo(LAN));
    let res = router(st).oneshot(req).await.unwrap();
    let status = res.status();
    let headers = res.headers().clone();
    let body = res.into_body().collect().await.unwrap().to_bytes();
    Reply { status, headers, body: String::from_utf8_lossy(&body).to_string() }
}

async fn csrf_token(st: Arc<AppState>) -> String {
    let reply = send(st, "GET", "/kasir/login", "", None, None).await;
    cookie_of(&reply.headers, "csrf_token").expect("cookie csrf dari halaman login")
}

async fn login(st: Arc<AppState>, username: &str, password: &str) -> Reply {
    let token = csrf_token(st.clone()).await;
    send(
        st,
        "POST",
        "/api/v1/kasir/auth/login",
        &format!("csrf_token={token}"),
        Some(&token),
        Some(json!({"username": username, "password": password})),
    )
    .await
}

#[tokio::test]
async fn login_benar_memberi_cookie_sesi_dan_cek_logged_in() {
    let (_dir, st) = state("ok").await;
    let reply = login(st.clone(), "admin", "rahasia123").await;
    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);
    assert!(reply.body.contains("\"success\":true"), "{}", reply.body);
    let session = cookie_of(&reply.headers, "tm_session").expect("cookie sesi");
    let csrf = cookie_of(&reply.headers, "csrf_token").expect("csrf baru");

    let check = send(st, "GET", "/api/v1/kasir/auth/check", &format!("tm_session={session}"), None, None).await;
    assert_eq!(check.status, StatusCode::OK);
    assert!(check.body.contains("\"logged_in\":true"), "{}", check.body);
    assert!(check.body.contains("\"role\":\"admin\""));
    assert!(!csrf.is_empty());
}

#[tokio::test]
async fn lima_password_salah_berujung_429() {
    let (_dir, st) = state("throttle").await;
    // Username unik: login sukses pada test lain membersihkan kunci IP yang sama.
    add_user(&st, "throttle1", "kasir").await;
    for i in 1..=5 {
        let reply = login(st.clone(), "throttle1", "salah").await;
        assert_eq!(reply.status, StatusCode::UNAUTHORIZED, "percobaan {i}: {}", reply.body);
    }
    let reply = login(st.clone(), "throttle1", "salah").await;
    assert_eq!(reply.status, StatusCode::TOO_MANY_REQUESTS, "{}", reply.body);
}

#[tokio::test]
async fn kasir_tidak_boleh_endpoint_admin() {
    let (_dir, st) = state("rbac").await;
    add_user(&st, "kasir1", "kasir").await;
    let reply = login(st.clone(), "kasir1", "rahasia123").await;
    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);
    let session = cookie_of(&reply.headers, "tm_session").unwrap();
    let csrf = cookie_of(&reply.headers, "csrf_token").unwrap();
    let list = send(
        st,
        "GET",
        "/api/v1/kasir/user/",
        &format!("tm_session={session}; csrf_token={csrf}"),
        None,
        None,
    )
    .await;
    assert_eq!(list.status, StatusCode::FORBIDDEN);
    assert!(list.body.contains("Hanya Admin"), "{}", list.body);
}

#[tokio::test]
async fn mutasi_tanpa_csrf_ditolak() {
    let (_dir, st) = state("csrf").await;
    let reply = send(
        st,
        "POST",
        "/api/v1/kasir/auth/login",
        "",
        None,
        Some(json!({"username": "admin", "password": "rahasia123"})),
    )
    .await;
    assert_eq!(reply.status, StatusCode::BAD_REQUEST);
    assert!(reply.body.contains("CSRF"), "{}", reply.body);
}

#[tokio::test]
async fn admin_terakhir_dan_user_ber_shift_tidak_bisa_dihapus() {
    let (_dir, st) = state("hapus").await;
    let reply = login(st.clone(), "admin", "rahasia123").await;
    let session = cookie_of(&reply.headers, "tm_session").unwrap();
    let csrf = cookie_of(&reply.headers, "csrf_token").unwrap();
    let cookies = format!("tm_session={session}; csrf_token={csrf}");
    let admin_id: (i64,) = sqlx::query_as("SELECT id FROM user WHERE username = 'admin'")
        .fetch_one(&st.pool)
        .await
        .unwrap();

    let last_admin = send(
        st.clone(),
        "DELETE",
        &format!("/api/v1/kasir/user/{}", admin_id.0),
        &cookies,
        Some(&csrf),
        Some(json!({"confirm": "admin"})),
    )
    .await;
    assert_eq!(last_admin.status, StatusCode::BAD_REQUEST, "{}", last_admin.body);
    assert!(last_admin.body.contains("satu-satunya Admin"), "{}", last_admin.body);

    add_user(&st, "kasir2", "kasir").await;
    let kasir_id: (i64,) = sqlx::query_as("SELECT id FROM user WHERE username = 'kasir2'")
        .fetch_one(&st.pool)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO shift_record (kasir_id, waktu_mulai, modal_awal, total_billing, total_kantin, \
         total_qris, total_refund, status) VALUES (?, '2026-01-01 08:00:00', 0, 0, 0, 0, 0, 'SELESAI')",
    )
    .bind(kasir_id.0)
    .execute(&st.pool)
    .await
    .unwrap();

    let with_shift = send(
        st,
        "DELETE",
        &format!("/api/v1/kasir/user/{}", kasir_id.0),
        &cookies,
        Some(&csrf),
        Some(json!({"confirm": "kasir2"})),
    )
    .await;
    assert_eq!(with_shift.status, StatusCode::BAD_REQUEST, "{}", with_shift.body);
    assert!(with_shift.body.contains("riwayat shift"), "{}", with_shift.body);
}

#[tokio::test]
async fn logout_menghapus_cookie_sesi() {
    let (_dir, st) = state("logout").await;
    let reply = login(st.clone(), "admin", "rahasia123").await;
    let session = cookie_of(&reply.headers, "tm_session").unwrap();
    let csrf = cookie_of(&reply.headers, "csrf_token").unwrap();
    let out = send(
        st,
        "POST",
        "/api/v1/kasir/auth/logout",
        &format!("tm_session={session}; csrf_token={csrf}"),
        Some(&csrf),
        None,
    )
    .await;
    assert_eq!(out.status, StatusCode::OK, "{}", out.body);
    let cleared = out
        .headers
        .get_all("set-cookie")
        .iter()
        .filter_map(|v| v.to_str().ok())
        .any(|c| c.starts_with("tm_session=;") && c.contains("Max-Age=0"));
    assert!(cleared, "cookie sesi harus dikosongkan");
}
