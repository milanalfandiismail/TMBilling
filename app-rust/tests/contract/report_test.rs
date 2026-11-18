//! Kontrak laporan: billing, struk, hapus nota, audit log, PDF.

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
const KUNCI: &str = "kunci-uji-report";

struct TempDir(PathBuf);

impl TempDir {
    fn new(tag: &str) -> Self {
        let mut path = std::env::temp_dir();
        path.push(format!(
            "tm_report_{tag}_{}_{}",
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
    let mut semua = cookies;
    semua.push(format!("csrf_token={csrf}"));
    (semua, uid)
}

/// Satu transaksi billing + satu transaksi kantin pada tanggal lokal hari ini.
async fn seed_transaksi(st: &Arc<AppState>) -> i64 {
    let hari = tmbilling_server::utils::time::today_local(&st.cfg.timezone)
        .format("%Y-%m-%d")
        .to_string();
    let stamp = format!("{hari} 10:00:00");
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO transaksi (jenis, jumlah, menit, keterangan, dibuat_pada, no_nota, metode_pembayaran, operator)
         VALUES ('beli_paket_guest', 10000, 60, 'Guest uji', ?, 'TM-uji-001', 'Tunai', 'admin') RETURNING id",
    )
    .bind(&stamp)
    .fetch_one(&st.pool)
    .await
    .unwrap();
    let menu_id: i64 = sqlx::query_scalar(
        "INSERT INTO menu_item (nama, harga, stok, is_active) VALUES ('Kopi uji', 2500, 10, 1) RETURNING id",
    )
    .fetch_one(&st.pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO transaksi_menu (no_nota, menu_id, jumlah, total_harga, pc_kode, tanggal, kasir_id, tunai, kembalian, metode_pembayaran, operator)
         VALUES ('TMM-uji-001', ?, 2, 5000, 'PC-01', ?, NULL, 5000, 0, 'Tunai', 'admin')",
    )
    .bind(menu_id)
    .bind(&stamp)
    .execute(&st.pool)
    .await
    .unwrap();
    id
}

#[tokio::test]
async fn billing_menghitung_billing_refund_dan_kantin() {
    let (_dir, st) = state("billing").await;
    let (cookies, _uid) = admin(&st).await;
    seed_transaksi(&st).await;

    let reply = kirim(
        st.clone(),
        "GET",
        "/api/v1/kasir/report/laporan/billing",
        None,
        &cookies,
        None,
    )
    .await;
    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);
    let body = reply.json();
    assert_eq!(body["total_billing"], 10000, "{}", body);
    assert_eq!(body["total_kantin"], 5000, "{}", body);
    assert_eq!(body["total_pendapatan"], 15000, "{}", body);
    assert_eq!(body["total"], 1, "satu nota billing: {}", body);
    let lama = &body["data"][0];
    assert_eq!(lama["nama_pelanggan"], "Guest", "{lama}");
    assert_eq!(lama["pc_kode"], "-", "{lama}");
    assert_eq!(lama["paket_nama"], "Guest uji", "{lama}");
    assert!(!lama["waktu"].as_str().unwrap_or("").is_empty(), "{lama}");
}

#[tokio::test]
async fn nota_paket_tidak_boleh_dihapus() {
    let (_dir, st) = state("hapus").await;
    let (cookies, _uid) = admin(&st).await;
    let id = seed_transaksi(&st).await;

    let reply = kirim(
        st.clone(),
        "DELETE",
        &format!("/api/v1/kasir/report/transaksi/{id}"),
        None,
        &cookies,
        None,
    )
    .await;
    assert_eq!(reply.status, StatusCode::BAD_REQUEST, "{}", reply.body);
    assert!(
        reply.body.contains("Gunakan Refund"),
        "pesan: {}",
        reply.body
    );
}

#[tokio::test]
async fn struk_tidak_ada_404() {
    let (_dir, st) = state("struk").await;
    let (cookies, _uid) = admin(&st).await;
    let reply = kirim(
        st.clone(),
        "GET",
        "/api/v1/kasir/report/struk/999999",
        None,
        &cookies,
        None,
    )
    .await;
    assert_eq!(reply.status, StatusCode::NOT_FOUND, "{}", reply.body);
}

#[tokio::test]
async fn struk_memuat_meta_warnet() {
    let (_dir, st) = state("struk2").await;
    let (cookies, _uid) = admin(&st).await;
    let id = seed_transaksi(&st).await;
    let reply = kirim(
        st.clone(),
        "GET",
        &format!("/api/v1/kasir/report/struk/{id}"),
        None,
        &cookies,
        None,
    )
    .await;
    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);
    let body = reply.json();
    assert_eq!(body["no_nota"], "TM-uji-001", "{}", body);
    assert_eq!(body["nama_pelanggan"], "Guest", "{}", body);
    assert!(body["warnet_title"].is_string(), "{}", body);
}

#[tokio::test]
async fn log_clear_tanpa_arsip() {
    let (_dir, st) = state("log").await;
    let (cookies, _uid) = admin(&st).await;
    let reply = kirim(
        st.clone(),
        "POST",
        "/api/v1/kasir/report/log/clear",
        Some(json!({"archive": false})),
        &cookies,
        None,
    )
    .await;
    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);
    let body = reply.json();
    assert_eq!(body["success"], true);
    // Logger global per proses (OnceLock): berkas hidup di direktori test pertama
    // yang menginisialisasinya, jadi cukup pastikan pembersihan melaporkan sukses.
    assert_eq!(body["data"]["success"], true, "{body}");
}

#[tokio::test]
async fn export_billing_pdf() {
    let (_dir, st) = state("pdf").await;
    let (cookies, _uid) = admin(&st).await;
    seed_transaksi(&st).await;
    let reply = kirim(
        st.clone(),
        "GET",
        "/api/v1/kasir/report/export/billing",
        None,
        &cookies,
        None,
    )
    .await;
    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);
    assert!(
        reply.body.starts_with("%PDF"),
        "keluaran bukan PDF: {}",
        &reply.body[..20.min(reply.body.len())]
    );
}

#[tokio::test]
async fn billing_menampilkan_waktu_pelanggan_paket_dan_pc() {
    let (_dir, st) = state("billing_kolom").await;
    let (cookies, _uid) = admin(&st).await;
    let hari = tmbilling_server::utils::time::today_local(&st.cfg.timezone)
        .format("%Y-%m-%d")
        .to_string();

    let grup: i64 =
        sqlx::query_scalar("INSERT INTO grup (nama, aktif) VALUES ('Reguler Uji', 1) RETURNING id")
            .fetch_one(&st.pool)
            .await
            .unwrap();
    let paket: i64 = sqlx::query_scalar(
        "INSERT INTO paket (nama, durasi_menit, harga, grup_id, aktif)
         VALUES ('Paket Uji', 60, 8000, ?, 1) RETURNING id",
    )
    .bind(grup)
    .fetch_one(&st.pool)
    .await
    .unwrap();
    let pc: i64 = sqlx::query_scalar(
        "INSERT INTO pc (kode, nama, grup_id, aktif) VALUES ('PC-01', 'PC Uji', ?, 1) RETURNING id",
    )
    .bind(grup)
    .fetch_one(&st.pool)
    .await
    .unwrap();
    let member: i64 = sqlx::query_scalar(
        "INSERT INTO member (username, password_hash, nama_lengkap, grup_id, aktif)
         VALUES ('member_uji', 'x', 'Member Uji', ?, 1) RETURNING id",
    )
    .bind(grup)
    .fetch_one(&st.pool)
    .await
    .unwrap();
    let sesi_member: i64 = sqlx::query_scalar(
        "INSERT INTO sesi (tipe, member_id, pc_id, paket_id, status, is_afk)
         VALUES ('member', ?, ?, ?, 'selesai', 0) RETURNING id",
    )
    .bind(member)
    .bind(pc)
    .bind(paket)
    .fetch_one(&st.pool)
    .await
    .unwrap();
    let sesi_guest: i64 = sqlx::query_scalar(
        "INSERT INTO sesi (tipe, pc_id, nama_guest, status, is_afk)
         VALUES ('guest', ?, 'Budi Guest', 'selesai', 0) RETURNING id",
    )
    .bind(pc)
    .fetch_one(&st.pool)
    .await
    .unwrap();
    let stamp = format!("{hari} 11:00:00");
    for (sesi, nota, jenis) in [
        (sesi_member, "TM-uji-member", "beli_paket_member"),
        (sesi_guest, "TM-uji-guest", "beli_paket_guest"),
    ] {
        let anggota = (jenis == "beli_paket_member").then_some(member);
        sqlx::query(
            "INSERT INTO transaksi (sesi_id, member_id, paket_id, jenis, jumlah, menit, dibuat_pada, no_nota, metode_pembayaran)
             VALUES (?, ?, ?, ?, 8000, 60, ?, ?, 'Tunai')",
        )
        .bind(sesi)
        .bind(anggota)
        .bind(anggota.map(|_| paket))
        .bind(jenis)
        .bind(&stamp)
        .bind(nota)
        .execute(&st.pool)
        .await
        .unwrap();
    }

    let reply = kirim(
        st.clone(),
        "GET",
        "/api/v1/kasir/report/laporan/billing",
        None,
        &cookies,
        None,
    )
    .await;
    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);
    let body = reply.json();
    let rows = body["data"].as_array().expect("data array");
    let member_row = rows
        .iter()
        .find(|r| r["no_nota"] == "TM-uji-member")
        .unwrap();
    assert_eq!(member_row["nama_pelanggan"], "Member Uji", "{member_row}");
    assert_eq!(member_row["paket_nama"], "Paket Uji", "{member_row}");
    assert_eq!(member_row["pc_kode"], "PC-01", "{member_row}");
    assert!(
        member_row["waktu"].as_str().unwrap_or("").contains(':'),
        "{member_row}"
    );
    let guest_row = rows
        .iter()
        .find(|r| r["no_nota"] == "TM-uji-guest")
        .unwrap();
    assert_eq!(guest_row["nama_pelanggan"], "Budi Guest", "{guest_row}");
    assert_eq!(guest_row["pc_kode"], "PC-01", "{guest_row}");
}
