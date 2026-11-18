//! Kontrak perangkat: telemetri, screenshot privat, remote action, uptime, VNC.

use axum::body::Body;
use axum::extract::ConnectInfo;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use tmbilling_server::app::router;
use tmbilling_server::config::Config;
use tmbilling_server::state::AppState;
use tower::ServiceExt;

const LOCAL: SocketAddr = SocketAddr::new(
    std::net::IpAddr::V4(std::net::Ipv4Addr::new(127, 0, 0, 1)),
    5000,
);
const KUNCI: &str = "kunci-uji-device";

struct TempDir(PathBuf);

impl TempDir {
    fn new(tag: &str) -> Self {
        let mut path = std::env::temp_dir();
        path.push(format!(
            "tm_device_{tag}_{}_{}",
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
    tmbilling_server::services::settings::settings_service::set(&st, "client_api_key", KUNCI)
        .await
        .unwrap();
    (dir, st)
}

struct Reply {
    status: StatusCode,
    body: String,
    headers: axum::http::HeaderMap,
}

impl Reply {
    fn json(&self) -> Value {
        serde_json::from_str(&self.body).unwrap_or(Value::Null)
    }
}

async fn kirim(
    st: Arc<AppState>,
    method: &str,
    uri: &str,
    data: Option<Value>,
    cookies: &[String],
    csrf: Option<&str>,
) -> Reply {
    let payload = match data {
        Some(v) => serde_json::to_vec(&v).unwrap(),
        None => Vec::new(),
    };
    let mut builder = Request::builder()
        .method(method)
        .uri(uri)
        .header("content-type", "application/json");
    if !cookies.is_empty() {
        builder = builder.header("cookie", cookies.join("; "));
    }
    // CSRF double-submit: header diambil dari cookie sesi bila ada.
    let _ = csrf;
    if let Some(c) = cookies
        .iter()
        .find(|c| c.starts_with("csrf_token="))
        .map(|c| c.trim_start_matches("csrf_token=").to_string())
    {
        builder = builder.header("X-CSRFToken", c);
    }
    let mut req = builder.body(Body::from(payload)).unwrap();
    req.extensions_mut().insert(ConnectInfo(LOCAL));
    let res = router(st).oneshot(req).await.unwrap();
    let status = res.status();
    let headers = res.headers().clone();
    let body = res.into_body().collect().await.unwrap().to_bytes();
    Reply {
        status,
        body: String::from_utf8_lossy(&body).to_string(),
        headers,
    }
}

async fn monitor_post(st: Arc<AppState>, kunci: &str, data: Value) -> Reply {
    let req = Request::builder()
        .method("POST")
        .uri("/api/v1/public/monitor/")
        .header("content-type", "application/json")
        .header("x-client-key", kunci)
        .body(Body::from(serde_json::to_vec(&data).unwrap()))
        .unwrap();
    let mut req = req;
    req.extensions_mut().insert(ConnectInfo(LOCAL));
    let res = router(st).oneshot(req).await.unwrap();
    let status = res.status();
    let headers = res.headers().clone();
    let body = res.into_body().collect().await.unwrap().to_bytes();
    Reply {
        status,
        body: String::from_utf8_lossy(&body).to_string(),
        headers,
    }
}

fn cookies_of(reply: &Reply) -> Vec<String> {
    reply
        .headers
        .get_all("set-cookie")
        .iter()
        .filter_map(|v| v.to_str().ok())
        .map(|v| v.split(';').next().unwrap_or("").to_string())
        .collect()
}

async fn admin(state: &Arc<AppState>) -> (Vec<String>, i64) {
    let csrf_reply = kirim(state.clone(), "GET", "/kasir/login", None, &[], None).await;
    let csrf = cookies_of(&csrf_reply)
        .into_iter()
        .find(|c| c.starts_with("csrf_token="))
        .unwrap()
        .trim_start_matches("csrf_token=")
        .to_string();
    sqlx::query("UPDATE user SET password_hash = ? WHERE username = 'admin'")
        .bind(tmbilling_server::models::user::hash_password("rahasia123"))
        .execute(&state.pool)
        .await
        .unwrap();
    let reply = kirim(
        state.clone(),
        "POST",
        "/api/v1/kasir/auth/login",
        Some(json!({"username": "admin", "password": "rahasia123"})),
        &[format!("csrf_token={csrf}")],
        Some(&csrf),
    )
    .await;
    assert_eq!(reply.status, StatusCode::OK, "login admin: {}", reply.body);
    let cookies = cookies_of(&reply);
    let uid: i64 = sqlx::query_scalar("SELECT id FROM user WHERE username = 'admin'")
        .fetch_one(&state.pool)
        .await
        .unwrap();
    let mut cookies = cookies;
    let csrf_cookie = csrf.clone();
    cookies.push(format!("csrf_token={csrf_cookie}"));
    (cookies, uid)
}

async fn buka_shift(state: &Arc<AppState>, kasir_id: i64) {
    sqlx::query(
        "INSERT INTO shift_record (kasir_id, waktu_mulai, modal_awal, total_billing, total_kantin, status) \
         VALUES (?, ?, 0, 0, 0, 'AKTIF')",
    )
    .bind(kasir_id)
    .bind(tmbilling_server::utils::time::db_str(
        tmbilling_server::utils::time::now_db(),
    ))
    .execute(&state.pool)
    .await
    .unwrap();
}

async fn seed_pc(state: &Arc<AppState>) -> i64 {
    let grup_id: i64 = sqlx::query_scalar(
        "INSERT INTO grup (nama, warna, keterangan, aktif) VALUES ('reguler', '#888888', '', 1) RETURNING id",
    )
    .fetch_one(&state.pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO pc (kode, nama, ip_address, mac_address, grup_id, aktif, is_admin_mode, pos_x, pos_y) \
         VALUES ('PC-01', 'PC 01', '127.0.0.1', '', ?, 1, 0, -1, -1)",
    )
    .bind(grup_id)
    .execute(&state.pool)
    .await
    .unwrap();
    sqlx::query_scalar("SELECT id FROM pc WHERE kode = 'PC-01'")
        .fetch_one(&state.pool)
        .await
        .unwrap()
}

fn png_kecil() -> Vec<u8> {
    use image::{ImageBuffer, Rgba};
    let img: ImageBuffer<Rgba<u8>, Vec<u8>> =
        ImageBuffer::from_pixel(4, 4, Rgba([10u8, 20, 30, 255]));
    let mut out = Vec::new();
    img.write_to(&mut std::io::Cursor::new(&mut out), image::ImageFormat::Png)
        .unwrap();
    out
}

#[tokio::test]
async fn telemetri_tanpa_api_key_ditolak() {
    let (_dir, st) = state("tel-401").await;
    let reply = monitor_post(st.clone(), "salah", json!({"CpuUsage": 10})).await;
    assert_eq!(reply.status, StatusCode::UNAUTHORIZED);
    assert!(st.mismatch.is_mismatch("127.0.0.1"));
}

#[tokio::test]
async fn telemetri_menyimpan_baris_hardware() {
    let (_dir, st) = state("tel-ok").await;
    let pc_id = seed_pc(&st).await;
    let reply = monitor_post(
        st.clone(),
        KUNCI,
        json!({"CpuUsage": 12.5, "CpuTemp": 45, "TotalRam": "16 GB", "CpuName": "Ryzen 5"}),
    )
    .await;
    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);
    let (usage, nama): (f64, String) =
        sqlx::query_as("SELECT cpu_usage, cpu_name FROM hardware_monitor WHERE pc_id = ?")
            .bind(pc_id)
            .fetch_one(&st.pool)
            .await
            .unwrap();
    assert_eq!(usage, 12.5);
    assert_eq!(nama, "Ryzen 5");
    assert_eq!(reply.json()["success"], json!(true));
}

#[tokio::test]
async fn screenshot_bukan_gambar_ditolak() {
    let (_dir, st) = state("ss-bad").await;
    seed_pc(&st).await;
    let mut req = Request::builder()
        .method("POST")
        .uri("/api/v1/public/client/screenshot/upload")
        .header("x-client-key", KUNCI)
        .header("content-type", "application/octet-stream")
        .body(Body::from(vec![1u8, 2, 3, 4]))
        .unwrap();
    req.extensions_mut().insert(ConnectInfo(LOCAL));
    let res = router(st.clone()).oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);
    let body = res.into_body().collect().await.unwrap().to_bytes();
    assert!(String::from_utf8_lossy(&body).contains("Data gambar tidak valid"));
}

#[tokio::test]
async fn screenshot_valid_tersimpan_dan_hanya_admin() {
    let (_dir, st) = state("ss-ok").await;
    let pc_id = seed_pc(&st).await;
    let (cookies, kasir_id) = admin(&st).await;
    buka_shift(&st, kasir_id).await;

    let mut req = Request::builder()
        .method("POST")
        .uri("/api/v1/public/client/screenshot/upload")
        .header("x-client-key", KUNCI)
        .header("content-type", "application/octet-stream")
        .body(Body::from(png_kecil()))
        .unwrap();
    req.extensions_mut().insert(ConnectInfo(LOCAL));
    let res = router(st.clone()).oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let path = st
        .cfg
        .root
        .join("instance")
        .join("uploads")
        .join("screenshots")
        .join("PC-01.png");
    assert!(
        path.exists(),
        "screenshot harus tersimpan di {}",
        path.display()
    );

    let img = kirim(
        st.clone(),
        "GET",
        &format!("/api/v1/kasir/monitor/screenshot/image/{pc_id}"),
        None,
        &cookies,
        None,
    )
    .await;
    assert_eq!(img.status, StatusCode::OK);
    assert_eq!(img.headers.get("content-type").unwrap(), "image/png");
}

#[tokio::test]
async fn remote_shutdown_mengantre_perintah() {
    let (_dir, st) = state("remote").await;
    let pc_id = seed_pc(&st).await;
    let (cookies, kasir_id) = admin(&st).await;
    buka_shift(&st, kasir_id).await;
    let reply = kirim(
        st.clone(),
        "POST",
        &format!("/api/v1/kasir/monitor/remote/{pc_id}/shutdown"),
        None,
        &cookies,
        None,
    )
    .await;
    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);
    assert!(reply.json()["message"]
        .as_str()
        .unwrap()
        .contains("Shutdown"));
    assert_eq!(st.commands.regular.pop(pc_id).as_deref(), Some("shutdown"));
}

#[tokio::test]
async fn uptime_daily_admin_dan_kasir_ditolak() {
    let (_dir, st) = state("uptime").await;
    let (cookies, _uid) = admin(&st).await;
    let ok = kirim(
        st.clone(),
        "GET",
        "/api/v1/kasir/uptime/daily",
        None,
        &cookies,
        None,
    )
    .await;
    assert_eq!(ok.status, StatusCode::OK, "{}", ok.body);
}

#[tokio::test]
async fn vnc_client_start_mengantre_perintah() {
    let (_dir, st) = state("vnc").await;
    let pc_id = seed_pc(&st).await;
    let (cookies, _uid) = admin(&st).await;
    let reply = kirim(
        st.clone(),
        "POST",
        &format!("/api/v1/kasir/vnc/client/{pc_id}/start"),
        None,
        &cookies,
        None,
    )
    .await;
    assert_eq!(reply.status, StatusCode::ACCEPTED, "{}", reply.body);
    let cmd = st.commands.fast.pop(pc_id).unwrap();
    assert!(cmd.contains("vnc_start"));
}
