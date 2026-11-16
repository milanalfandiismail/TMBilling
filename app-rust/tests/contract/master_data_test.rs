//! Kontrak master data: grup berantai, paket, PC, menu, dan checkout F&B.

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
            "tm_master_{tag}_{}_{}",
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

async fn send_raw(
    st: Arc<AppState>,
    method: &str,
    uri: &str,
    cookies: &str,
    csrf: Option<&str>,
    content_type: &str,
    payload: Vec<u8>,
) -> Reply {
    let mut builder = Request::builder()
        .method(method)
        .uri(uri)
        .header("content-type", content_type);
    if !cookies.is_empty() {
        builder = builder.header("cookie", cookies);
    }
    if let Some(token) = csrf {
        builder = builder.header("x-csrftoken", token);
    }
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

async fn buat_grup(st: Arc<AppState>, cookies: &str, csrf: &str, nama: &str) -> i64 {
    let reply = send(
        st.clone(),
        "POST",
        "/api/v1/kasir/grup/",
        cookies,
        Some(csrf),
        Some(json!({ "nama": nama, "warna": "#123456" })),
    )
    .await;
    assert_eq!(reply.status, StatusCode::CREATED, "{}", reply.body);
    // Python hanya membalas success+message; id dibaca dari daftar.
    let reply = send(st, "GET", "/api/v1/kasir/grup/", cookies, None, None).await;
    reply.json()["grup"]
        .as_array()
        .unwrap()
        .iter()
        .find(|g| g["nama"].as_str() == Some(nama))
        .and_then(|g| g["id"].as_i64())
        .unwrap()
}

async fn buat_paket(st: Arc<AppState>, cookies: &str, csrf: &str, nama: &str, grup: &str) -> i64 {
    let reply = send(
        st,
        "POST",
        "/api/v1/kasir/paket/",
        cookies,
        Some(csrf),
        Some(json!({ "nama": nama, "durasi_menit": 60, "harga": 8000, "grup": grup })),
    )
    .await;
    assert_eq!(reply.status, StatusCode::CREATED, "{}", reply.body);
    reply.json()["id"].as_i64().unwrap()
}

async fn buat_pc(st: Arc<AppState>, cookies: &str, csrf: &str, kode: &str, ip: &str) -> i64 {
    let reply = send(
        st,
        "POST",
        "/api/v1/kasir/pc/",
        cookies,
        Some(csrf),
        Some(json!({ "kode": kode, "nama": kode, "ip_address": ip, "grup": "vip" })),
    )
    .await;
    assert_eq!(reply.status, StatusCode::CREATED, "{}", reply.body);
    reply.json()["pc"]["id"].as_i64().unwrap()
}

async fn buat_menu(st: Arc<AppState>, cookies: &str, csrf: &str, nama: &str, stok: i64) -> i64 {
    let reply = send(
        st,
        "POST",
        "/api/v1/kasir/menu",
        cookies,
        Some(csrf),
        Some(json!({ "nama": nama, "harga": 5000, "stok": stok })),
    )
    .await;
    assert_eq!(reply.status, StatusCode::CREATED, "{}", reply.body);
    reply.json()["data"]["id"].as_i64().unwrap()
}

#[tokio::test]
async fn arsip_grup_menonaktifkan_paket_dan_pc() {
    let (_dir, st) = state("arsip_grup").await;
    let (cookies, csrf) = admin_session(st.clone()).await;
    let grup_id = buat_grup(st.clone(), &cookies, &csrf, "vip").await;
    let paket_id = buat_paket(st.clone(), &cookies, &csrf, "Paket VIP", "vip").await;
    let pc_id = buat_pc(st.clone(), &cookies, &csrf, "PC-1", "192.168.1.10").await;

    let reply = send(
        st.clone(),
        "POST",
        &format!("/api/v1/kasir/grup/{grup_id}/archive"),
        &cookies,
        Some(&csrf),
        None,
    )
    .await;
    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);

    for (tabel, id) in [("paket", paket_id), ("pc", pc_id)] {
        let aktif: i64 = sqlx::query_scalar(&format!("SELECT aktif FROM {tabel} WHERE id = ?"))
            .bind(id)
            .fetch_one(&st.pool)
            .await
            .unwrap();
        assert_eq!(aktif, 0, "{tabel} ikut terarsip");
    }
}

#[tokio::test]
async fn hapus_paket_butuh_konfirmasi_nama() {
    let (_dir, st) = state("hapus_paket").await;
    let (cookies, csrf) = admin_session(st.clone()).await;
    buat_grup(st.clone(), &cookies, &csrf, "reguler").await;
    let paket_id = buat_paket(st.clone(), &cookies, &csrf, "Paket Pagi", "reguler").await;

    let reply = send(
        st.clone(),
        "DELETE",
        &format!("/api/v1/kasir/paket/{paket_id}"),
        &cookies,
        Some(&csrf),
        None,
    )
    .await;
    assert_eq!(reply.status, StatusCode::BAD_REQUEST, "{}", reply.body);

    let reply = send(
        st.clone(),
        "DELETE",
        &format!("/api/v1/kasir/paket/{paket_id}"),
        &cookies,
        Some(&csrf),
        Some(json!({ "confirm": "paket pagi" })),
    )
    .await;
    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);
}

#[tokio::test]
async fn paket_dengan_grup_tidak_ada_ditolak() {
    let (_dir, st) = state("paket_grup").await;
    let (cookies, csrf) = admin_session(st.clone()).await;
    let reply = send(
        st,
        "POST",
        "/api/v1/kasir/paket/",
        &cookies,
        Some(&csrf),
        Some(json!({ "nama": "Paket Hantu", "durasi_menit": 30, "harga": 1000, "grup": "hilang" })),
    )
    .await;
    assert_eq!(reply.status, StatusCode::BAD_REQUEST, "{}", reply.body);
}

#[tokio::test]
async fn hapus_pc_melepas_sesi_dan_menghapus_screenshot() {
    let (_dir, st) = state("hapus_pc").await;
    let (cookies, csrf) = admin_session(st.clone()).await;
    buat_grup(st.clone(), &cookies, &csrf, "vip").await;
    let pc_id = buat_pc(st.clone(), &cookies, &csrf, "PC-7", "192.168.1.17").await;

    let sesi_id: i64 = sqlx::query_scalar(
        "INSERT INTO sesi (tipe, pc_id, status, is_afk) VALUES ('guest', ?, 'aktif', 0) RETURNING id",
    )
    .bind(pc_id)
    .fetch_one(&st.pool)
    .await
    .unwrap();

    let shot = st.cfg.root.join("instance/uploads/screenshots/PC-7.png");
    std::fs::create_dir_all(shot.parent().unwrap()).unwrap();
    std::fs::write(&shot, b"png").unwrap();

    let reply = send(
        st.clone(),
        "DELETE",
        &format!("/api/v1/kasir/pc/{pc_id}"),
        &cookies,
        Some(&csrf),
        Some(json!({ "confirm": "pc-7" })),
    )
    .await;
    // Sesi aktif menahan hapus; akhiri sesi dulu seperti alur kasir.
    assert_eq!(reply.status, StatusCode::BAD_REQUEST, "{}", reply.body);

    sqlx::query("UPDATE sesi SET status = 'selesai' WHERE id = ?")
        .bind(sesi_id)
        .execute(&st.pool)
        .await
        .unwrap();
    let reply = send(
        st.clone(),
        "DELETE",
        &format!("/api/v1/kasir/pc/{pc_id}"),
        &cookies,
        Some(&csrf),
        Some(json!({ "confirm": "pc-7" })),
    )
    .await;
    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);

    let pc_id_kolom: Option<i64> = sqlx::query_scalar("SELECT pc_id FROM sesi WHERE id = ?")
        .bind(sesi_id)
        .fetch_one(&st.pool)
        .await
        .unwrap();
    assert_eq!(pc_id_kolom, None, "riwayat sesi tetap ada tanpa pc_id");
    assert!(!shot.exists(), "screenshot PC ikut dihapus");
}

#[tokio::test]
async fn urutan_pc_natural_bukan_leksikal() {
    let (_dir, st) = state("urut_pc").await;
    let (cookies, csrf) = admin_session(st.clone()).await;
    buat_grup(st.clone(), &cookies, &csrf, "vip").await;
    buat_pc(st.clone(), &cookies, &csrf, "PC-10", "192.168.1.20").await;
    buat_pc(st.clone(), &cookies, &csrf, "PC-2", "192.168.1.12").await;

    let reply = send(st, "GET", "/api/v1/kasir/pc/", &cookies, None, None).await;
    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);
    let list = reply.json();
    let urutan: Vec<String> = list["pc_list"]
        .as_array()
        .unwrap()
        .iter()
        .map(|p| p["kode"].as_str().unwrap().to_string())
        .collect();
    assert_eq!(urutan, vec!["PC-2", "PC-10"]);
}

#[tokio::test]
async fn buat_menu_dengan_nama_di_arsip_menghidupkan_ulang() {
    let (_dir, st) = state("menu_restore").await;
    let (cookies, csrf) = admin_session(st.clone()).await;
    let menu_id = buat_menu(st.clone(), &cookies, &csrf, "Kopi Hitam", 5).await;

    let reply = send(
        st.clone(),
        "DELETE",
        &format!("/api/v1/kasir/menu/{menu_id}"),
        &cookies,
        Some(&csrf),
        None,
    )
    .await;
    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);

    let reply = send(
        st.clone(),
        "POST",
        "/api/v1/kasir/menu",
        &cookies,
        Some(&csrf),
        Some(json!({ "nama": "Kopi Hitam", "harga": 7000, "stok": 9 })),
    )
    .await;
    assert_eq!(reply.status, StatusCode::CREATED, "{}", reply.body);
    let data = reply.json()["data"].clone();
    assert_eq!(
        data["id"].as_i64(),
        Some(menu_id),
        "baris arsip dipakai ulang"
    );
    assert_eq!(data["harga"].as_i64(), Some(7000));
    assert_eq!(data["stok"].as_i64(), Some(9));
    assert_eq!(data["is_active"].as_bool(), Some(true));
}

#[tokio::test]
async fn tambah_stok_menu_unlimited_ditolak() {
    let (_dir, st) = state("stok_unlimited").await;
    let (cookies, csrf) = admin_session(st.clone()).await;
    let menu_id = buat_menu(st.clone(), &cookies, &csrf, "Es Teh", -1).await;

    let reply = send(
        st.clone(),
        "POST",
        &format!("/api/v1/kasir/menu/{menu_id}/tambah-stok"),
        &cookies,
        Some(&csrf),
        Some(json!({ "jumlah_tambah": 5 })),
    )
    .await;
    assert_eq!(reply.status, StatusCode::BAD_REQUEST, "{}", reply.body);
    assert!(reply.body.contains("Unlimited"), "{}", reply.body);
}

#[tokio::test]
async fn checkout_tunai_kurang_ditolak_lalu_stok_berkurang() {
    let (_dir, st) = state("checkout").await;
    let (cookies, csrf) = admin_session(st.clone()).await;
    let menu_id = buat_menu(st.clone(), &cookies, &csrf, "Mie Goreng", 10).await;

    let body = json!({
        "cart_items": [{ "menu_id": menu_id, "jumlah": 2 }],
        "metode_pembayaran": "Tunai",
        "tunai": 1000,
    });
    let reply = send(
        st.clone(),
        "POST",
        "/api/v1/kasir/menu/checkout",
        &cookies,
        Some(&csrf),
        Some(body.clone()),
    )
    .await;
    assert_eq!(reply.status, StatusCode::BAD_REQUEST, "{}", reply.body);

    let mut cukup = body.clone();
    cukup["tunai"] = json!(20000);
    let reply = send(
        st.clone(),
        "POST",
        "/api/v1/kasir/menu/checkout",
        &cookies,
        Some(&csrf),
        Some(cukup),
    )
    .await;
    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);
    let stok: i64 = sqlx::query_scalar("SELECT stok FROM menu_item WHERE id = ?")
        .bind(menu_id)
        .fetch_one(&st.pool)
        .await
        .unwrap();
    assert_eq!(stok, 8, "stok terpotong sesuai kuantitas");
}

#[tokio::test]
async fn upload_gambar_bukan_gambar_ditolak() {
    let (_dir, st) = state("upload_menu").await;
    let (cookies, csrf) = admin_session(st.clone()).await;

    let boundary = "----tmtest";
    let mut body = Vec::new();
    body.extend_from_slice(
        format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"nama\"\r\n\r\nRoti Bakar\r\n\
             --{boundary}\r\nContent-Disposition: form-data; name=\"harga\"\r\n\r\n9000\r\n\
             --{boundary}\r\nContent-Disposition: form-data; name=\"stok\"\r\n\r\n4\r\n"
        )
        .as_bytes(),
    );
    body.extend_from_slice(
        format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"gambar\"; filename=\"palsu.png\"\r\nContent-Type: image/png\r\n\r\n"
        )
        .as_bytes(),
    );
    body.extend_from_slice(b"ini bukan gambar sama sekali");
    body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());

    let reply = send_raw(
        st,
        "POST",
        "/api/v1/kasir/menu",
        &cookies,
        Some(&csrf),
        &format!("multipart/form-data; boundary={boundary}"),
        body,
    )
    .await;
    assert_eq!(reply.status, StatusCode::BAD_REQUEST, "{}", reply.body);
    assert!(
        reply.body.contains("File gambar tidak valid"),
        "{}",
        reply.body
    );
}
