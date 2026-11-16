//! Kontrak settings: redaksi per role, allowlist key generik, apikey, timezone, token whitelist.

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

const LAN: SocketAddr = SocketAddr::new(
    std::net::IpAddr::V4(std::net::Ipv4Addr::new(192, 168, 1, 50)),
    5000,
);

struct TempDir(PathBuf);

impl TempDir {
    fn new(tag: &str) -> Self {
        let mut path = std::env::temp_dir();
        path.push(format!(
            "tm_auth_{tag}_{}_{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
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
    // Lewat service agar cache write-through ikut diperbarui (seed_defaults sudah mengisi "true").
    tmbilling_server::services::settings::settings_service::set(
        &st,
        "ip_whitelist_enabled",
        "false",
    )
    .await
    .unwrap();
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
        .map(|c| {
            c.split_once('=')
                .map(|(_, v)| v.to_string())
                .unwrap_or_default()
        })
}

async fn send(
    st: Arc<AppState>,
    method: &str,
    uri: &str,
    cookies: &str,
    csrf: Option<&str>,
    body: Option<Value>,
) -> Reply {
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
    Reply {
        status,
        headers,
        body: String::from_utf8_lossy(&body).to_string(),
    }
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
async fn kasir_hanya_melihat_payment_methods_admin_dapat_apikey() {
    let (_dir, st) = state("redaksi").await;
    add_user(&st, "kasir1", "kasir").await;

    let admin = login(st.clone(), "admin", "rahasia123").await;
    let admin_cookie = format!(
        "tm_session={}",
        cookie_of(&admin.headers, "tm_session").unwrap()
    );
    let reply = send(
        st.clone(),
        "GET",
        "/api/v1/kasir/settings/",
        &admin_cookie,
        None,
        None,
    )
    .await;
    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);
    let body: Value = serde_json::from_str(&reply.body).unwrap();
    assert!(
        body["settings"].get("client_api_key").is_some(),
        "{}",
        reply.body
    );

    let kasir = login(st.clone(), "kasir1", "rahasia123").await;
    assert_eq!(kasir.status, StatusCode::OK, "{}", kasir.body);
    let kasir_cookie = format!(
        "tm_session={}",
        cookie_of(&kasir.headers, "tm_session").unwrap()
    );
    let reply = send(
        st,
        "GET",
        "/api/v1/kasir/settings/",
        &kasir_cookie,
        None,
        None,
    )
    .await;
    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);
    let body: Value = serde_json::from_str(&reply.body).unwrap();
    let keys: Vec<&String> = body["settings"].as_object().unwrap().keys().collect();
    assert_eq!(keys, vec![&"payment_methods".to_string()], "{}", reply.body);
}

#[tokio::test]
async fn put_generik_menolak_key_di_luar_allowlist() {
    let (_dir, st) = state("allowlist").await;
    let admin = login(st.clone(), "admin", "rahasia123").await;
    let csrf = cookie_of(&admin.headers, "csrf_token").unwrap();
    let cookie = format!(
        "tm_session={}; csrf_token={csrf}",
        cookie_of(&admin.headers, "tm_session").unwrap()
    );
    let reply = send(
        st.clone(),
        "PUT",
        "/api/v1/kasir/settings/kasir_id",
        &cookie,
        Some(&csrf),
        Some(json!({"value": "1"})),
    )
    .await;
    assert_eq!(reply.status, StatusCode::BAD_REQUEST, "{}", reply.body);

    let reply = send(
        st,
        "PUT",
        "/api/v1/kasir/settings/warnet_title",
        &cookie,
        Some(&csrf),
        Some(json!({"value": "Warnet Baru"})),
    )
    .await;
    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);
}

#[tokio::test]
async fn apikey_dan_timezone_divalidasi() {
    let (_dir, st) = state("validasi").await;
    let admin = login(st.clone(), "admin", "rahasia123").await;
    let csrf = cookie_of(&admin.headers, "csrf_token").unwrap();
    let cookie = format!(
        "tm_session={}; csrf_token={csrf}",
        cookie_of(&admin.headers, "tm_session").unwrap()
    );

    let reply = send(
        st.clone(),
        "PUT",
        "/api/v1/kasir/settings/apikey",
        &cookie,
        Some(&csrf),
        Some(json!({"value": "abc"})),
    )
    .await;
    assert_eq!(reply.status, StatusCode::BAD_REQUEST, "{}", reply.body);

    let reply = send(
        st.clone(),
        "PUT",
        "/api/v1/kasir/settings/timezone",
        &cookie,
        Some(&csrf),
        Some(json!({"value": "Mars/Olympus"})),
    )
    .await;
    assert_eq!(reply.status, StatusCode::BAD_REQUEST, "{}", reply.body);

    let reply = send(
        st,
        "PUT",
        "/api/v1/kasir/settings/timezone",
        &cookie,
        Some(&csrf),
        Some(json!({"value": "Asia/Jakarta"})),
    )
    .await;
    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);
}

#[tokio::test]
async fn regenerate_token_memberi_token_panjang() {
    let (_dir, st) = state("token").await;
    let admin = login(st.clone(), "admin", "rahasia123").await;
    let csrf = cookie_of(&admin.headers, "csrf_token").unwrap();
    let cookie = format!(
        "tm_session={}; csrf_token={csrf}",
        cookie_of(&admin.headers, "tm_session").unwrap()
    );
    let reply = send(
        st,
        "POST",
        "/api/v1/kasir/settings/ip-whitelist/regenerate-token",
        &cookie,
        Some(&csrf),
        None,
    )
    .await;
    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);
    let body: Value = serde_json::from_str(&reply.body).unwrap();
    assert!(
        body["token"].as_str().unwrap().len() >= 20,
        "{}",
        reply.body
    );
}
