//! Kontrak Task 8: member, shift blind-cash, catatan serah terima.

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
            "tm_t8_{tag}_{}_{}",
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

struct Reply {
    status: StatusCode,
    headers: HeaderMap,
    body: String,
}

impl Reply {
    fn json(&self) -> Value {
        serde_json::from_str(&self.body).unwrap_or(Value::Null)
    }
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

/// Cookie sesi admin + token CSRF siap pakai untuk mutasi.
async fn csrf_token(st: Arc<AppState>) -> String {
    let reply = send(st, "GET", "/kasir/login", "", None, None).await;
    cookie_of(&reply.headers, "csrf_token").unwrap_or_default()
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

/// Bikin kasir kedua, login, kembalikan (cookie, csrf).
fn cookie_dari(reply: &Reply) -> (String, String) {
    let session = cookie_of(&reply.headers, "tm_session").expect("cookie sesi");
    let csrf = cookie_of(&reply.headers, "csrf_token").expect("csrf");
    (format!("tm_session={session}; csrf_token={csrf}"), csrf)
}

async fn admin(st: Arc<AppState>) -> (String, String) {
    let reply = login(st, "admin", "rahasia123").await;
    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);
    cookie_dari(&reply)
}

#[tokio::test]
async fn maintenance_dan_arsip() {
    let (_dir, st) = state("maint").await;
    let (cookie, csrf) = admin(st.clone()).await;
    sqlx::query("INSERT INTO grup (nama, warna, keterangan, aktif, dibuat_pada) VALUES ('reguler', '#888888', '', 1, '2026-01-01 00:00:00')")
        .execute(&st.pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO pc (kode, nama, ip_address, mac_address, grup_id, aktif, is_admin_mode, pos_x, pos_y) VALUES ('PC-01','PC 01','192.168.1.10','AA:BB:CC:DD:EE:01',1,1,0,-1,-1)")
        .execute(&st.pool)
        .await
        .unwrap();

    let tiket = send(
        st.clone(),
        "POST",
        "/api/v1/kasir/maintenance/create",
        &cookie,
        Some(&csrf),
        Some(json!({"pc_id": 1, "kategori": "HARDWARE", "prioritas": "TINGGI", "judul": "Mouse rusak"})),
    )
    .await;
    assert_eq!(tiket.status, StatusCode::CREATED, "{}", tiket.body);

    let daftar = send(
        st.clone(),
        "GET",
        "/api/v1/kasir/maintenance/list",
        &cookie,
        None,
        None,
    )
    .await;
    assert_eq!(daftar.status, StatusCode::OK, "{}", daftar.body);
    assert_eq!(daftar.json()["tickets"].as_array().unwrap().len(), 1);

    let status = send(
        st.clone(),
        "PUT",
        "/api/v1/kasir/maintenance/1/status",
        &cookie,
        Some(&csrf),
        Some(json!({"status": "SELESAI", "biaya": 25000})),
    )
    .await;
    assert_eq!(status.status, StatusCode::OK, "{}", status.body);

    let arsip = send(
        st.clone(),
        "GET",
        "/api/v1/kasir/arsip/",
        &cookie,
        None,
        None,
    )
    .await;
    assert_eq!(arsip.status, StatusCode::OK, "{}", arsip.body);
    assert!(arsip.json()["data"]["pc"].is_array());
}

#[tokio::test]
async fn tutorial_create_dan_kategori() {
    let (_dir, st) = state("tut").await;
    let (cookie, csrf) = admin(st.clone()).await;

    let dibuat = send(
        st.clone(),
        "POST",
        "/api/v1/kasir/tutorials",
        &cookie,
        Some(&csrf),
        Some(json!({"title": "Cara buka shift", "content": "Tekan tombol buka shift.", "category": "Operasional"})),
    )
    .await;
    assert_eq!(dibuat.status, StatusCode::CREATED, "{}", dibuat.body);

    let kosong = send(
        st.clone(),
        "POST",
        "/api/v1/kasir/tutorials",
        &cookie,
        Some(&csrf),
        Some(json!({"title": ""})),
    )
    .await;
    assert_eq!(kosong.status, StatusCode::BAD_REQUEST);

    let kategori = send(
        st.clone(),
        "GET",
        "/api/v1/kasir/tutorials/categories",
        &cookie,
        None,
        None,
    )
    .await;
    assert_eq!(kategori.status, StatusCode::OK, "{}", kategori.body);
    assert_eq!(kategori.json()["categories"][0]["name"], "Operasional");
}

#[tokio::test]
async fn tournament_bracket_dan_skor() {
    let (_dir, st) = state("turn").await;
    let (cookie, csrf) = admin(st.clone()).await;

    let buat = send(
        st.clone(),
        "POST",
        "/api/v1/kasir/tournament",
        &cookie,
        Some(&csrf),
        Some(
            json!({"nama": "Turnamen Uji", "tipe_jalur": "playoff", "bo_format": 3,
                    "teams": ["Alpha", "Bravo"]}),
        ),
    )
    .await;
    assert_eq!(buat.status, StatusCode::CREATED, "{}", buat.body);

    let satu_tim = send(
        st.clone(),
        "POST",
        "/api/v1/kasir/tournament",
        &cookie,
        Some(&csrf),
        Some(json!({"nama": "Kurang Tim", "tipe_jalur": "playoff", "teams": ["Sendiri"]})),
    )
    .await;
    assert_eq!(satu_tim.status, StatusCode::BAD_REQUEST);

    let daftar = send(
        st.clone(),
        "GET",
        "/api/v1/kasir/tournament/",
        &cookie,
        None,
        None,
    )
    .await;
    assert_eq!(daftar.status, StatusCode::OK, "{}", daftar.body);
    assert_eq!(daftar.json()["tournaments"].as_array().unwrap().len(), 1);
}

#[tokio::test]
async fn dashboard_dan_tv_publik() {
    let (_dir, st) = state("dash").await;
    let (cookie, _csrf) = admin(st.clone()).await;
    sqlx::query("INSERT INTO grup (nama, warna, keterangan, aktif, dibuat_pada) VALUES ('reguler', '#888888', '', 1, '2026-01-01 00:00:00')")
        .execute(&st.pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO pc (kode, nama, ip_address, mac_address, grup_id, aktif, is_admin_mode, pos_x, pos_y) VALUES ('PC-01','PC 01','192.168.1.10','AA:BB:CC:DD:EE:01',1,1,0,-1,-1)")
        .execute(&st.pool)
        .await
        .unwrap();

    let kartu = send(
        st.clone(),
        "GET",
        "/api/v1/kasir/dashboard/pc",
        &cookie,
        None,
        None,
    )
    .await;
    assert_eq!(kartu.status, StatusCode::OK, "{}", kartu.body);
    assert_eq!(kartu.json()["pc_list"].as_array().unwrap().len(), 1);
    assert!(kartu.json()["by_grup"]["reguler"].is_array());

    let tv = send(st.clone(), "GET", "/api/v1/public/tv/data", "", None, None).await;
    assert_eq!(tv.status, StatusCode::OK, "{}", tv.body);
    assert_eq!(tv.json()["data"]["occupancy"]["total_pc"], 1);
}
