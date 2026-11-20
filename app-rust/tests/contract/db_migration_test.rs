//! Kontrak migrasi database Python 1.6.5: pratinjau selisih skema dan impor aman.
use axum::body::Body;
use axum::extract::ConnectInfo;
use axum::http::{HeaderMap, Request, StatusCode};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use sqlx::SqlitePool;
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
            "tm_migrasi_{tag}_{}_{}",
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

fn fixture(nama: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
        .join(nama)
}

struct Reply {
    status: StatusCode,
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
        .map(|c| c.split_once('=').map(|(_, v)| v.to_string()).unwrap_or_default())
}

struct Sesi {
    cookie: String,
    csrf: String,
}

async fn login(st: Arc<AppState>) -> Sesi {
    let pre = kirim(st.clone(), "GET", "/kasir/login", "", None, Body::empty(), None).await;
    let csrf = cookie_of(&pre.1, "csrf_token").expect("csrf dari halaman login");
    let res = kirim(
        st,
        "POST",
        "/api/v1/kasir/auth/login",
        &format!("csrf_token={csrf}"),
        Some(&csrf),
        Body::from(json!({"username":"admin","password":"rahasia123"}).to_string()),
        Some("application/json"),
    )
    .await;
    assert_eq!(res.0, StatusCode::OK, "{}", res.2);
    let session = cookie_of(&res.1, "tm_session").expect("cookie sesi");
    Sesi {
        cookie: format!("tm_session={session}; csrf_token={csrf}"),
        csrf,
    }
}

async fn kirim(
    st: Arc<AppState>,
    method: &str,
    uri: &str,
    cookies: &str,
    csrf: Option<&str>,
    body: Body,
    tipe: Option<&str>,
) -> (StatusCode, HeaderMap, String) {
    let mut builder = Request::builder().method(method).uri(uri);
    if !cookies.is_empty() {
        builder = builder.header("cookie", cookies);
    }
    if let Some(t) = csrf {
        builder = builder.header("x-csrftoken", t);
    }
    if let Some(t) = tipe {
        builder = builder.header("content-type", t);
    }
    let mut req = builder.body(body).unwrap();
    req.extensions_mut().insert(ConnectInfo(LAN));
    let res = router(st).oneshot(req).await.unwrap();
    let status = res.status();
    let headers = res.headers().clone();
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    (status, headers, String::from_utf8_lossy(&bytes).to_string())
}

async fn preview(st: Arc<AppState>, sesi: &Sesi, bytes: &[u8]) -> (StatusCode, Value) {
    let mut body = Vec::new();
    body.extend_from_slice(
        b"--tmtest\r\nContent-Disposition: form-data; name=\"file\"; filename=\"warnet.db\"\r\nContent-Type: application/octet-stream\r\n\r\n",
    );
    body.extend_from_slice(bytes);
    body.extend_from_slice(b"\r\n--tmtest--\r\n");
    let (status, _, teks) = kirim(
        st,
        "POST",
        "/api/v1/kasir/settings/database/import/preview",
        &sesi.cookie,
        Some(&sesi.csrf),
        Body::from(body),
        Some("multipart/form-data; boundary=tmtest"),
    )
    .await;
    let v: Value = serde_json::from_str(&teks).unwrap_or(Value::Null);
    (status, v)
}

async fn buka_berkas(path: &std::path::Path) -> SqlitePool {
    sqlx::sqlite::SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(
            sqlx::sqlite::SqliteConnectOptions::new()
                .filename(path)
                .create_if_missing(true),
        )
        .await
        .unwrap()
}

async fn apply(st: Arc<AppState>, sesi: &Sesi, token: &str) -> (StatusCode, Value) {
    let (status, _, teks) = kirim(
        st,
        "POST",
        "/api/v1/kasir/settings/database/import/apply",
        &sesi.cookie,
        Some(&sesi.csrf),
        Body::from(json!({"token": token}).to_string()),
        Some("application/json"),
    )
    .await;
    (status, serde_json::from_str(&teks).unwrap_or(Value::Null))
}

#[tokio::test]
async fn preview_mengenali_database_python_dan_selisih_skema() {
    let (_dir, st) = state("preview").await;
    let sesi = login(st.clone()).await;
    let bytes = std::fs::read(fixture("warnet_legacy.db")).unwrap();
    let (status, body) = preview(st, &sesi, &bytes).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["token"].as_str().unwrap().len(), 64);
    let p = &body["preview"];
    assert_eq!(p["tables"], 10, "{body}");
    assert!(p["missing_tables"].as_array().unwrap().len() >= 10, "{body}");
    assert!(p["missing_indexes"].as_array().unwrap().len() >= 1, "{body}");
    assert!(p["missing_columns"].as_array().unwrap().len() >= 1, "{body}");
    assert_eq!(p["python_revision"], Value::Null);
}

#[tokio::test]
async fn apply_menyalin_data_dan_membuat_safety_backup() {
    let (_dir, st) = state("apply").await;
    let sesi = login(st.clone()).await;
    let sumber = std::env::temp_dir().join(format!("tm_sumber_{}.db", std::process::id()));
    std::fs::copy(fixture("warnet_legacy.db"), &sumber).unwrap();
    let pool = buka_berkas(&sumber).await;
    for sql in [
        "INSERT INTO grup (id, nama) VALUES (1, 'Reguler')",
        "INSERT INTO pc (id, kode, nama, grup_id) VALUES (1, 'PC-01', 'Meja 1', 1)",
        "INSERT INTO member (id, username, password_hash, grup_id) VALUES (1, 'legacy_marker', 'x', 1)",
        "INSERT INTO sesi (id, tipe, member_id, pc_id, status, nama_guest) VALUES (1, 'member', 1, 1, 'selesai', NULL)",
        "INSERT INTO transaksi (id, sesi_id, member_id, jenis, jumlah) VALUES (1, 1, 1, 'tutup_sesi', 0)",
    ] {
        sqlx::query(sql).execute(&pool).await.unwrap();
    }
    pool.close().await;
    let bytes = std::fs::read(&sumber).unwrap();
    let (status, pratinjau) = preview(st.clone(), &sesi, &bytes).await;
    assert_eq!(status, StatusCode::OK, "{pratinjau}");
    let token = pratinjau["token"].as_str().unwrap().to_string();

    let (status, body) = apply(st.clone(), &sesi, &token).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["result"]["tables_imported"], 10, "{body}");
    assert!(body["result"]["safety_backup"]
        .as_str()
        .unwrap()
        .starts_with("pre_import_"));
    let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM member WHERE username='legacy_marker'")
        .fetch_one(&st.pool)
        .await
        .unwrap();
    assert_eq!(n, 1);
    let sesi_lama: (i64, Option<String>) =
        sqlx::query_as("SELECT is_afk, nama_guest FROM sesi WHERE id=1")
            .fetch_one(&st.pool)
            .await
            .unwrap();
    assert_eq!(sesi_lama, (0, None));
    let rev: String = sqlx::query_scalar("SELECT version_num FROM alembic_version")
        .fetch_one(&st.pool)
        .await
        .unwrap();
    assert_eq!(rev, tmbilling_server::db::migrate::HEAD_REVISION);
    let whitelist: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM settings WHERE key='ip_whitelist_enabled'")
            .fetch_one(&st.pool)
            .await
            .unwrap();
    assert_eq!(whitelist, 1, "default settings harus diisi ulang");
}

#[tokio::test]
async fn apply_menolak_database_bukan_tmbilling_tanpa_mengubah_data() {
    let (_dir, st) = state("bukan").await;
    let sesi = login(st.clone()).await;
    let lain = std::env::temp_dir().join(format!("tm_lain_{}.db", std::process::id()));
    let pool = buka_berkas(&lain).await;
    sqlx::query("CREATE TABLE foo (id INTEGER)").execute(&pool).await.unwrap();
    pool.close().await;
    let bytes = std::fs::read(&lain).unwrap();
    let (status, body) = preview(st.clone(), &sesi, &bytes).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let token = body["token"].as_str().unwrap().to_string();
    let sebelum: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM user")
        .fetch_one(&st.pool)
        .await
        .unwrap();
    let (status, body) = apply(st.clone(), &sesi, &token).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    let sesudah: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM user")
        .fetch_one(&st.pool)
        .await
        .unwrap();
    assert_eq!(sebelum, sesudah);
}

#[tokio::test]
async fn apply_menolak_token_tidak_valid() {
    let (_dir, st) = state("token").await;
    let sesi = login(st.clone()).await;
    let (status, body) = apply(st, &sesi, "../../etc/passwd").await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
}
