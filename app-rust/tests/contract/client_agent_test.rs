//! Kontrak client agent: API key, identify, status/heartbeat, antrean perintah.

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
use tmbilling_server::state::AppState;
use tower::ServiceExt;

const LOCAL: SocketAddr = SocketAddr::new(
    std::net::IpAddr::V4(std::net::Ipv4Addr::new(127, 0, 0, 1)),
    5000,
);
const KUNCI: &str = "kunci-uji-client";

struct TempDir(PathBuf);

impl TempDir {
    fn new(tag: &str) -> Self {
        let mut path = std::env::temp_dir();
        path.push(format!(
            "tm_client_{tag}_{}_{}",
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
    headers: HeaderMap,
    body: String,
}

impl Reply {
    fn json(&self) -> Value {
        serde_json::from_str(&self.body).unwrap_or(Value::Null)
    }
}

fn siapkan(
    state: Arc<AppState>,
    method: &str,
    uri: &str,
    kunci: Option<&str>,
    ip: &str,
    data: Option<Value>,
) -> (Arc<AppState>, Request<Body>) {
    let payload = match data {
        Some(v) => serde_json::to_vec(&v).unwrap(),
        None => Vec::new(),
    };
    let mut builder = Request::builder()
        .method(method)
        .uri(uri)
        .header("content-type", "application/json");
    if let Some(k) = kunci {
        builder = builder.header("x-client-key", k);
    }
    let mut req = builder.body(Body::from(payload)).unwrap();
    req.extensions_mut().insert(ConnectInfo(LOCAL));
    let _ = ip;
    (state, req)
}

async fn kirim(
    st: Arc<AppState>,
    method: &str,
    uri: &str,
    kunci: Option<&str>,
    data: Option<Value>,
) -> Reply {
    let (st, req) = siapkan(st, method, uri, kunci, "127.0.0.1", data);
    let res = router(st).oneshot(req).await.unwrap();
    let status = res.status();
    let headers: HeaderMap = res.headers().clone();
    let body = res.into_body().collect().await.unwrap().to_bytes();
    Reply {
        status,
        headers,
        body: String::from_utf8_lossy(&body).to_string(),
    }
}

async fn seed_pc(st: &AppState) -> i64 {
    let grup_id: i64 = sqlx::query_scalar(
        "INSERT INTO grup (nama, warna, keterangan, aktif) VALUES ('reguler', '#888888', '', 1) RETURNING id",
    )
    .fetch_one(&st.pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO pc (kode, nama, ip_address, mac_address, grup_id, aktif, is_admin_mode, pos_x, pos_y) \
         VALUES ('PC-01', 'PC 01', '127.0.0.1', '', ?, 1, 0, -1, -1)",
    )
    .bind(grup_id)
    .execute(&st.pool)
    .await
    .unwrap();
    sqlx::query_scalar("SELECT id FROM pc WHERE kode = 'PC-01'")
        .fetch_one(&st.pool)
        .await
        .unwrap()
}

#[tokio::test]
async fn api_key_salah_ditolak_dan_dicatat() {
    let (_dir, st) = state("apikey").await;
    let reply = kirim(
        st.clone(),
        "POST",
        "/api/v1/public/client/status",
        Some("salah"),
        Some(json!({})),
    )
    .await;
    assert_eq!(reply.status, StatusCode::UNAUTHORIZED);
    assert!(reply.json()["error"]
        .as_str()
        .unwrap()
        .contains("API Key tidak valid"));
    assert!(st.mismatch.is_mismatch("127.0.0.1"));
}

#[tokio::test]
async fn identify_mendaftarkan_mac_kosong() {
    let (_dir, st) = state("identify").await;
    seed_pc(&st).await;
    let reply = kirim(
        st.clone(),
        "POST",
        "/api/v1/public/client/identify",
        Some(KUNCI),
        Some(json!({"ip_address": "127.0.0.1", "mac_address": "aa:bb:cc:dd:ee:ff"})),
    )
    .await;
    assert_eq!(reply.status, StatusCode::OK);
    let body = reply.json();
    assert_eq!(body["valid"], json!(true));
    assert_eq!(body["pc_kode"], json!("PC-01"));
    let mac: String = sqlx::query_scalar("SELECT mac_address FROM pc WHERE kode = 'PC-01'")
        .fetch_one(&st.pool)
        .await
        .unwrap();
    assert_eq!(mac, "AA:BB:CC:DD:EE:FF");
}

#[tokio::test]
async fn status_pc_tidak_dikenal() {
    let (_dir, st) = state("unknown").await;
    let reply = kirim(
        st.clone(),
        "POST",
        "/api/v1/public/client/status",
        Some(KUNCI),
        Some(json!({"ip_address": "127.0.0.1"})),
    )
    .await;
    assert_eq!(reply.status, StatusCode::OK);
    let body = reply.json();
    assert_eq!(body["status"], json!("kosong"));
    assert_eq!(body["message"], json!("PC tidak dikenal"));
}

#[tokio::test]
async fn status_sesi_aktif_dan_heartbeat_ditahan() {
    let (_dir, st) = state("aurora").await;
    let pc_id = seed_pc(&st).await;
    let paket_id: i64 = sqlx::query_scalar(
        "INSERT INTO paket (nama, durasi_menit, harga, kadaluarsa_hari, grup_id, aktif) \
         VALUES ('Paket 60', 60, 8000, 30, (SELECT grup_id FROM pc WHERE id = ?), 1) RETURNING id",
    )
    .bind(pc_id)
    .fetch_one(&st.pool)
    .await
    .unwrap();
    tmbilling_server::services::sesi::sesi_service::buka_guest(
        &st,
        Some("PC-01"),
        Some(paket_id),
        Some("Guest"),
        "kasir1",
        Some("Tunai"),
    )
    .await
    .unwrap();
    let reply = kirim(
        st.clone(),
        "POST",
        "/api/v1/public/client/status",
        Some(KUNCI),
        Some(json!({"ip_address": "127.0.0.1"})),
    )
    .await;
    assert_eq!(reply.status, StatusCode::OK);
    let body = reply.json();
    assert_eq!(body["status"], json!("aktif"));
    assert_eq!(body["pc_kode"], json!("PC-01"));
    assert!(body["sisa_waktu"].as_i64().unwrap() >= 59);
    let detik = body["sisa_detik"].as_i64().unwrap();
    assert!(detik > 59 * 60 && detik <= 60 * 60, "sisa_detik={detik}");
    let mulai = body["mulai"].as_str().expect("mulai");
    assert_eq!(mulai.len(), 5, "mulai={mulai}");
    let db_mulai: String = sqlx::query_scalar("SELECT mulai_pada FROM sesi WHERE pc_id = ?")
        .bind(pc_id)
        .fetch_one(&st.pool)
        .await
        .unwrap();
    let harap = tmbilling_server::utils::time::format_clock(
        tmbilling_server::utils::time::parse_dt(&db_mulai).unwrap(),
        &st.cfg.timezone,
    );
    assert_eq!(mulai, harap);
    let pertama: String = sqlx::query_scalar("SELECT last_sync FROM sesi WHERE pc_id = ?")
        .bind(pc_id)
        .fetch_one(&st.pool)
        .await
        .unwrap();
    assert!(!pertama.is_empty());
    let _ = kirim(
        st.clone(),
        "POST",
        "/api/v1/public/client/status",
        Some(KUNCI),
        Some(json!({"ip_address": "127.0.0.1"})),
    )
    .await;
    let kedua: String = sqlx::query_scalar("SELECT last_sync FROM sesi WHERE pc_id = ?")
        .bind(pc_id)
        .fetch_one(&st.pool)
        .await
        .unwrap();
    assert_eq!(pertama, kedua);
}

#[tokio::test]
async fn perintah_cepat_fifo() {
    let (_dir, st) = state("fifo").await;
    let pc_id = seed_pc(&st).await;
    st.commands.fast.push(pc_id, "vnc_start");
    st.commands.fast.push(pc_id, "vnc_stop");
    let satu = kirim(
        st.clone(),
        "POST",
        "/api/v1/public/client/fast_poll",
        Some(KUNCI),
        Some(json!({"ip_address": "127.0.0.1"})),
    )
    .await;
    assert_eq!(satu.json()["command"], json!("vnc_start"));
    let dua = kirim(
        st.clone(),
        "POST",
        "/api/v1/public/client/fast_poll",
        Some(KUNCI),
        Some(json!({"ip_address": "127.0.0.1"})),
    )
    .await;
    assert_eq!(dua.json()["command"], json!("vnc_stop"));
}

#[tokio::test]
async fn kasir_boleh_login_admin_dan_role_asli_dibalas() {
    let (_dir, st) = state("adminlogin").await;
    seed_pc(&st).await;
    let hash = tmbilling_server::models::user::hash_password("rahasia123");
    for (username, role) in [("kasir1", "kasir"), ("admin1", "admin")] {
        sqlx::query(
            "INSERT INTO user (username, password_hash, nama_lengkap, role, aktif) \
             VALUES (?, ?, ?, ?, 1)",
        )
        .bind(username)
        .bind(&hash)
        .bind(format!("Nama {username}"))
        .bind(role)
        .execute(&st.pool)
        .await
        .unwrap();
    }
    let body = json!({
        "ip_address": "127.0.0.1",
        "mac_address": "aa:bb:cc:dd:ee:ff",
        "username": "kasir1",
        "password": "rahasia123",
        "role": "admin",
    });
    let reply = kirim(
        st.clone(),
        "POST",
        "/api/v1/public/client/admin-login",
        Some(KUNCI),
        Some(body.clone()),
    )
    .await;
    assert_eq!(reply.status, StatusCode::OK);
    assert_eq!(reply.json()["user"]["role"], json!("kasir"));

    let salah = kirim(
        st.clone(),
        "POST",
        "/api/v1/public/client/admin-login",
        Some(KUNCI),
        Some(json!({
            "ip_address": "127.0.0.1",
            "mac_address": "aa:bb:cc:dd:ee:ff",
            "username": "admin1",
            "password": "salah",
        })),
    )
    .await;
    assert_eq!(salah.status, StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn status_member_membawa_data_profil() {
    let (_dir, st) = state("profil").await;
    let pc_id = seed_pc(&st).await;
    sqlx::query(
        "INSERT INTO member (username, password_hash, nama_lengkap, email, no_hp, grup_id, aktif, \
         dibuat_pada, waktu_tersimpan, kadaluarsa_pada) \
         VALUES ('budi', 'x', 'Budi', 'budi@warnet.id', '081234567890', \
         (SELECT grup_id FROM pc WHERE id = ?), 1, '2026-11-01 10:00:00', 600, \
         '2026-12-22 11:15:55')",
    )
    .bind(pc_id)
    .execute(&st.pool)
    .await
    .unwrap();
    tmbilling_server::services::sesi::sesi_service::buka_member(&st, Some("PC-01"), Some("budi"), "kasir1")
        .await
        .unwrap();
    let reply = kirim(
        st.clone(),
        "POST",
        "/api/v1/public/client/status",
        Some(KUNCI),
        Some(json!({"ip_address": "127.0.0.1"})),
    )
    .await;
    assert_eq!(reply.status, StatusCode::OK);
    let body = reply.json();
    let m = &body["member"];
    assert_eq!(m["nama_lengkap"], json!("Budi"));
    assert_eq!(m["email"], json!("budi@warnet.id"));
    assert_eq!(m["no_hp"], json!("081234567890"));
    assert!(m["kadaluarsa_pada_display"].is_string(), "member={m}");
    assert!(m["dibuat_pada_display"].is_string(), "member={m}");
}

#[tokio::test]
async fn paket_update_404_saat_file_belum_ada() {
    let (_dir, st) = state("update_kosong").await;
    let reply = kirim(
        st,
        "GET",
        "/api/v1/public/client/update.exe",
        Some(KUNCI),
        None,
    )
    .await;
    assert_eq!(reply.status, StatusCode::NOT_FOUND);
    assert!(reply.json()["error"]
        .as_str()
        .unwrap()
        .contains("belum tersedia"));
}

#[tokio::test]
async fn paket_update_mengirim_biner_dari_folder_root() {
    let (dir, st) = state("update_ada").await;
    let paket = dir.0.join("client-update");
    std::fs::create_dir_all(&paket).unwrap();
    std::fs::write(paket.join("TMBilling.exe"), b"exe-baru").unwrap();
    let reply = kirim(
        st,
        "GET",
        "/api/v1/public/client/update.exe",
        Some(KUNCI),
        None,
    )
    .await;
    assert_eq!(reply.status, StatusCode::OK);
    assert_eq!(
        reply.headers.get("content-type").unwrap(),
        "application/octet-stream"
    );
    assert_eq!(reply.body, "exe-baru");
}

#[tokio::test]
async fn paket_update_menolak_tanpa_api_key() {
    let (_dir, st) = state("update_tanpa_key").await;
    let reply = kirim(st, "GET", "/api/v1/public/client/update.exe", None, None).await;
    assert_eq!(reply.status, StatusCode::UNAUTHORIZED);
}
