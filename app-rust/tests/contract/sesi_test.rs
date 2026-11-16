//! Kontrak mesin sesi: buka, tambah waktu, refund, blackout.

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
            "tm_sesi_{tag}_{}_{}",
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

async fn admin_session(st: Arc<AppState>) -> (String, String) {
    let reply = send(st.clone(), "GET", "/kasir/login", "", None, None).await;
    let csrf = cookie_of(&reply.headers, "csrf_token").expect("csrf cookie");
    let reply = send(
        st,
        "POST",
        "/api/v1/kasir/auth/login",
        &format!("csrf_token={csrf}"),
        Some(&csrf),
        Some(json!({ "username": "admin", "password": "rahasia123" })),
    )
    .await;
    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);
    let sesi = cookie_of(&reply.headers, "tm_session").expect("cookie sesi");
    let csrf = cookie_of(&reply.headers, "csrf_token").unwrap_or(csrf);
    (format!("tm_session={sesi}; csrf_token={csrf}"), csrf)
}

/// Grup "vip" + paket 60 menit Rp 8.000 + satu PC kosong di grup yang sama.
async fn siapkan(st: Arc<AppState>, cookies: &str, csrf: &str) -> (i64, i64) {
    let grup = send(
        st.clone(),
        "POST",
        "/api/v1/kasir/grup/",
        cookies,
        Some(csrf),
        Some(json!({ "nama": "vip", "warna": "#123456" })),
    )
    .await;
    assert_eq!(grup.status, StatusCode::CREATED, "{}", grup.body);
    let paket = send(
        st.clone(),
        "POST",
        "/api/v1/kasir/paket/",
        cookies,
        Some(csrf),
        Some(json!({
            "nama": "Paket 1 Jam", "durasi_menit": 60, "harga": 8000, "grup": "vip"
        })),
    )
    .await;
    assert_eq!(paket.status, StatusCode::CREATED, "{}", paket.body);
    let pc = send(
        st,
        "POST",
        "/api/v1/kasir/pc/",
        cookies,
        Some(csrf),
        Some(json!({
            "kode": "PC-01", "nama": "PC-01", "ip_address": "192.168.1.10", "grup": "vip"
        })),
    )
    .await;
    assert_eq!(pc.status, StatusCode::CREATED, "{}", pc.body);
    (
        paket.json()["id"].as_i64().unwrap(),
        pc.json()["pc"]["id"].as_i64().unwrap(),
    )
}

async fn buka_guest(st: Arc<AppState>, cookies: &str, csrf: &str, paket_id: i64) -> (i64, Value) {
    let reply = send(
        st,
        "POST",
        "/api/v1/kasir/sesi/buka-guest",
        cookies,
        Some(csrf),
        Some(json!({
            "pc_kode": "PC-01", "paket_id": paket_id, "nama_guest": "Budi",
            "metode_pembayaran": "Tunai"
        })),
    )
    .await;
    assert_eq!(reply.status, StatusCode::CREATED, "{}", reply.body);
    let v = reply.json();
    (v["sesi_id"].as_i64().unwrap(), v)
}

async fn hitung(st: &AppState, sql: &str, id: i64) -> i64 {
    sqlx::query_scalar::<_, i64>(sql)
        .bind(id)
        .fetch_one(&st.pool)
        .await
        .unwrap()
}

#[tokio::test]
async fn buka_guest_lalu_tutup_mencatat_transaksi() {
    let (_dir, st) = state("buka_tutup").await;
    let (cookies, csrf) = admin_session(st.clone()).await;
    let (paket_id, _pc_id) = siapkan(st.clone(), &cookies, &csrf).await;
    let (sesi_id, v) = buka_guest(st.clone(), &cookies, &csrf, paket_id).await;

    assert_eq!(v["sisa_menit"].as_i64(), Some(60));
    assert_eq!(v["token_sesi"].as_str().unwrap().len(), 64);
    let jumlah = hitung(
        &st,
        "SELECT jumlah FROM transaksi WHERE sesi_id = ? AND jenis = 'beli_paket_guest'",
        sesi_id,
    )
    .await;
    assert_eq!(jumlah, 8000);

    let tutup = send(
        st.clone(),
        "POST",
        &format!("/api/v1/kasir/sesi/tutup/{sesi_id}"),
        &cookies,
        Some(&csrf),
        None,
    )
    .await;
    assert_eq!(tutup.status, StatusCode::OK, "{}", tutup.body);
    let status: String = sqlx::query_scalar("SELECT status FROM sesi WHERE id = ?")
        .bind(sesi_id)
        .fetch_one(&st.pool)
        .await
        .unwrap();
    assert_eq!(status, "selesai");
    let notul: i64 = hitung(
        &st,
        "SELECT COUNT(*) FROM transaksi WHERE sesi_id = ? AND jenis = 'tutup_sesi'",
        sesi_id,
    )
    .await;
    assert_eq!(notul, 1);
}

#[tokio::test]
async fn tambah_waktu_batch_menambah_durasi_sekali_commit() {
    let (_dir, st) = state("tambah").await;
    let (cookies, csrf) = admin_session(st.clone()).await;
    let (paket_id, _pc_id) = siapkan(st.clone(), &cookies, &csrf).await;
    let (sesi_id, _) = buka_guest(st.clone(), &cookies, &csrf, paket_id).await;

    let reply = send(
        st.clone(),
        "POST",
        "/api/v1/kasir/sesi/tambah-waktu-batch",
        &cookies,
        Some(&csrf),
        Some(json!({
            "sesi_ids": [sesi_id],
            "selections": [{"paket_id": paket_id, "qty": 2}],
            "metode_pembayaran": "Tunai",
            "client_request_id": "req-tambah-1"
        })),
    )
    .await;
    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);
    let durasi = hitung(
        &st,
        "SELECT durasi_beli_menit FROM sesi WHERE id = ?",
        sesi_id,
    )
    .await;
    assert_eq!(durasi, 180);
    let menit = hitung(
        &st,
        "SELECT menit FROM transaksi WHERE sesi_id = ? AND jenis = 'tambah_waktu_guest'",
        sesi_id,
    )
    .await;
    assert_eq!(menit, 120);

    // Idempotensi: permintaan dengan kunci sama ditolak.
    let ulang = send(
        st,
        "POST",
        "/api/v1/kasir/sesi/tambah-waktu-batch",
        &cookies,
        Some(&csrf),
        Some(json!({
            "sesi_ids": [sesi_id],
            "selections": [{"paket_id": paket_id, "qty": 2}],
            "client_request_id": "req-tambah-1"
        })),
    )
    .await;
    assert_eq!(ulang.status, StatusCode::BAD_REQUEST, "{}", ulang.body);
}

#[tokio::test]
async fn refund_paket_memotong_durasi_dan_menandai_refund() {
    let (_dir, st) = state("refund").await;
    let (cookies, csrf) = admin_session(st.clone()).await;
    let (paket_id, _pc_id) = siapkan(st.clone(), &cookies, &csrf).await;
    let (sesi_id, _) = buka_guest(st.clone(), &cookies, &csrf, paket_id).await;
    let transaksi_id = hitung(
        &st,
        "SELECT id FROM transaksi WHERE sesi_id = ? AND jenis = 'beli_paket_guest'",
        sesi_id,
    )
    .await;

    let reply = send(
        st.clone(),
        "POST",
        "/api/v1/kasir/sesi/refund-paket",
        &cookies,
        Some(&csrf),
        Some(json!({ "sesi_id": sesi_id, "transaksi_id": transaksi_id })),
    )
    .await;
    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);
    let durasi = hitung(
        &st,
        "SELECT durasi_beli_menit FROM sesi WHERE id = ?",
        sesi_id,
    )
    .await;
    assert_eq!(durasi, 0);
    let refunded = hitung(
        &st,
        "SELECT is_refunded FROM transaksi WHERE id = ?",
        transaksi_id,
    )
    .await;
    assert_eq!(refunded, 1);
    let menit = hitung(
        &st,
        "SELECT menit FROM transaksi WHERE sesi_id = ? AND jenis = 'refund_paket'",
        sesi_id,
    )
    .await;
    assert_eq!(menit, -60);
}

#[tokio::test]
async fn blackout_deteksi_lalu_tutup_tanpa_kompensasi() {
    let (_dir, st) = state("blackout").await;
    let (cookies, csrf) = admin_session(st.clone()).await;
    let (paket_id, _pc_id) = siapkan(st.clone(), &cookies, &csrf).await;
    let (sesi_id, _) = buka_guest(st.clone(), &cookies, &csrf, paket_id).await;

    // Sesi mulai 20 menit lalu, heartbeat terakhir 10 menit lalu → sisa audit 50 menit.
    sqlx::query(
        "UPDATE sesi SET mulai_pada = datetime('now', '-20 minutes'), \
         last_sync = datetime('now', '-10 minutes') WHERE id = ?",
    )
    .bind(sesi_id)
    .execute(&st.pool)
    .await
    .unwrap();

    let deteksi = send(
        st.clone(),
        "POST",
        "/api/v1/kasir/blackout/deteksi",
        &cookies,
        Some(&csrf),
        Some(json!({ "threshold_menit": 5 })),
    )
    .await;
    assert_eq!(deteksi.status, StatusCode::OK, "{}", deteksi.body);
    assert_eq!(deteksi.json()["total"].as_i64(), Some(1));
    let (suspect, sisa) = sqlx::query_as::<_, (i64, i64)>(
        "SELECT is_blackout_suspect, sisa_menit_saat_mati FROM sesi WHERE id = ?",
    )
    .bind(sesi_id)
    .fetch_one(&st.pool)
    .await
    .unwrap();
    assert_eq!(suspect, 1, "suspect={suspect} sisa={sisa}");
    assert!((49..=50).contains(&sisa), "sisa={sisa}");

    let tutup = send(
        st.clone(),
        "POST",
        &format!("/api/v1/kasir/blackout/resolve/guest/tutup/{sesi_id}"),
        &cookies,
        Some(&csrf),
        None,
    )
    .await;
    assert_eq!(tutup.status, StatusCode::OK, "{}", tutup.body);
    let resolved = hitung(
        &st,
        "SELECT is_blackout_resolved FROM sesi WHERE id = ?",
        sesi_id,
    )
    .await;
    assert_eq!(resolved, 1);
}
