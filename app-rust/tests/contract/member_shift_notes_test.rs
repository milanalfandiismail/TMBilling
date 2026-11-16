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
async fn sesi_kasir(st: Arc<AppState>) -> (String, String) {
    sqlx::query(
        "INSERT INTO user (username, password_hash, nama_lengkap, role, aktif, dibuat_pada, kuota_main_bulanan, sisa_kuota_menit) \
         VALUES ('kasir1', ?, 'Kasir Satu', 'kasir', 1, '2026-01-01 00:00:00', 0, 0)",
    )
    .bind(hash_password("rahasia123"))
    .execute(&st.pool)
    .await
    .unwrap();
    let reply = login(st, "kasir1", "rahasia123").await;
    assert_eq!(reply.status, StatusCode::OK, "{}", reply.body);
    let session = cookie_of(&reply.headers, "tm_session").expect("cookie sesi");
    let csrf = cookie_of(&reply.headers, "csrf_token").expect("csrf");
    (format!("tm_session={session}; csrf_token={csrf}"), csrf)
}

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
async fn member_crud_dan_tambah_waktu() {
    let (_dir, st) = state("member").await;
    let (admin_cookie, admin_csrf) = admin(st.clone()).await;

    sqlx::query("INSERT INTO grup (nama, warna, keterangan, aktif, dibuat_pada) VALUES ('reguler', '#888888', '', 1, '2026-01-01 00:00:00')")
        .execute(&st.pool)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO paket (nama, durasi_menit, harga, kadaluarsa_hari, grup_id, aktif) \
         VALUES ('1 Jam', 60, 8000, 30, 1, 1)",
    )
    .execute(&st.pool)
    .await
    .unwrap();

    let dibuat = send(
        st.clone(),
        "POST",
        "/api/v1/kasir/member",
        &admin_cookie,
        Some(&admin_csrf),
        Some(
            json!({"username": "member1", "password": "rahasia123", "nama_lengkap": "Member Satu"}),
        ),
    )
    .await;
    assert_eq!(dibuat.status, StatusCode::CREATED, "{}", dibuat.body);

    let daftar = send(
        st.clone(),
        "GET",
        "/api/v1/kasir/member?q=member1",
        &admin_cookie,
        None,
        None,
    )
    .await;
    assert_eq!(daftar.status, StatusCode::OK, "{}", daftar.body);
    let data = daftar.json();
    assert_eq!(data["total"].as_i64(), Some(1), "{data}");
    assert_eq!(data["members"][0]["username"], "member1");
    let member_id = data["members"][0]["id"].as_i64().unwrap();

    let topup = send(
        st.clone(),
        "POST",
        "/api/v1/kasir/member/tambah-waktu",
        &admin_cookie,
        Some(&admin_csrf),
        Some(json!({"member_id": member_id, "selections": [{"paket_id": 1, "qty": 2}]})),
    )
    .await;
    assert_eq!(topup.status, StatusCode::OK, "{}", topup.body);
    assert_eq!(topup.json()["message"], "Waktu berhasil ditambah");

    let saldo: i64 = sqlx::query_scalar("SELECT waktu_tersimpan FROM member WHERE id = ?")
        .bind(member_id)
        .fetch_one(&st.pool)
        .await
        .unwrap();
    assert_eq!(saldo, 120);

    let arsip = send(
        st.clone(),
        "POST",
        &format!("/api/v1/kasir/member/{member_id}/archive"),
        &admin_cookie,
        Some(&admin_csrf),
        None,
    )
    .await;
    assert_eq!(arsip.status, StatusCode::OK, "{}", arsip.body);
    let aktif: i64 = sqlx::query_scalar("SELECT aktif FROM member WHERE id = ?")
        .bind(member_id)
        .fetch_one(&st.pool)
        .await
        .unwrap();
    assert_eq!(aktif, 0);
}

#[tokio::test]
async fn shift_wajib_sebelum_layani_transaksi() {
    let (_dir, st) = state("shift").await;
    let (kasir_cookie, kasir_csrf) = sesi_kasir(st.clone()).await;

    let tanpa_shift = send(
        st.clone(),
        "GET",
        "/api/v1/kasir/member/1",
        &kasir_cookie,
        None,
        None,
    )
    .await;
    assert_eq!(
        tanpa_shift.status,
        StatusCode::BAD_REQUEST,
        "{}",
        tanpa_shift.body
    );
    assert!(tanpa_shift.body.contains("Harap buka shift"));

    let buka = send(
        st.clone(),
        "POST",
        "/api/v1/kasir/shift/start",
        &kasir_cookie,
        Some(&kasir_csrf),
        Some(json!({"modal_awal": 100000})),
    )
    .await;
    assert_eq!(buka.status, StatusCode::CREATED, "{}", buka.body);
    assert_eq!(buka.json()["shift"]["status"], "AKTIF");

    let aktif = send(
        st.clone(),
        "GET",
        "/api/v1/kasir/shift/active",
        &kasir_cookie,
        None,
        None,
    )
    .await;
    assert_eq!(aktif.status, StatusCode::OK, "{}", aktif.body);
    assert_eq!(aktif.json()["shift"]["modal_awal"].as_i64(), Some(100000));

    let tutup = send(
        st.clone(),
        "POST",
        "/api/v1/kasir/shift/end",
        &kasir_cookie,
        Some(&kasir_csrf),
        Some(json!({"uang_fisik": 100000, "catatan": "tutup"})),
    )
    .await;
    assert_eq!(tutup.status, StatusCode::OK, "{}", tutup.body);
    let result = &tutup.json()["result"];
    assert_eq!(result["selisih"].as_i64(), Some(0), "{result}");
    assert_eq!(result["status"], "SELESAI");
}

#[tokio::test]
async fn notes_siklus_hidup() {
    let (_dir, st) = state("notes").await;
    let (admin_cookie, admin_csrf) = admin(st.clone()).await;

    let buat = send(
        st.clone(),
        "POST",
        "/api/v1/kasir/notes",
        &admin_cookie,
        Some(&admin_csrf),
        Some(json!({"title": "Serah Terima", "content": "kas shift pagi"})),
    )
    .await;
    assert_eq!(buat.status, StatusCode::CREATED, "{}", buat.body);
    let filename = buat.json()["note"]["filename"]
        .as_str()
        .unwrap()
        .to_string();
    let enc = filename.replace(' ', "%20");
    assert_eq!(filename, "Serah Terima.txt");

    let simpan = send(
        st.clone(),
        "PUT",
        &format!("/api/v1/kasir/notes/{enc}"),
        &admin_cookie,
        Some(&admin_csrf),
        Some(json!({"content": "kas shift pagi, lanjut sore"})),
    )
    .await;
    assert_eq!(simpan.status, StatusCode::OK, "{}", simpan.body);

    let pin = send(
        st.clone(),
        "POST",
        &format!("/api/v1/kasir/notes/{enc}/pin"),
        &admin_cookie,
        Some(&admin_csrf),
        None,
    )
    .await;
    assert_eq!(pin.status, StatusCode::OK, "{}", pin.body);
    assert_eq!(pin.json()["result"]["is_pinned"], true);

    let daftar = send(
        st.clone(),
        "GET",
        "/api/v1/kasir/notes",
        &admin_cookie,
        None,
        None,
    )
    .await;
    assert_eq!(daftar.status, StatusCode::OK, "{}", daftar.body);
    assert_eq!(daftar.json()["notes"][0]["is_pinned"], true);

    let salinan = send(
        st.clone(),
        "POST",
        &format!("/api/v1/kasir/notes/{enc}/duplicate"),
        &admin_cookie,
        Some(&admin_csrf),
        None,
    )
    .await;
    assert_eq!(salinan.status, StatusCode::CREATED, "{}", salinan.body);
    let salinan_nama = salinan.json()["note"]["filename"]
        .as_str()
        .unwrap_or("")
        .to_string();
    assert!(
        salinan_nama.starts_with("Serah Terima") && salinan_nama.ends_with(".txt"),
        "{salinan_nama}"
    );

    let hapus = send(
        st.clone(),
        "DELETE",
        &format!("/api/v1/kasir/notes/{enc}"),
        &admin_cookie,
        Some(&admin_csrf),
        None,
    )
    .await;
    assert_eq!(hapus.status, StatusCode::OK, "{}", hapus.body);
    assert!(hapus.body.contains("berhasil dihapus"));
}
