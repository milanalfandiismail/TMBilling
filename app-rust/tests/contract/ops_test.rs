//! Kontrak operasional: backup, restore, statistik DB, migrasi, IP whitelist.

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

struct TempDir(PathBuf);

impl TempDir {
    fn new(tag: &str) -> Self {
        let mut path = std::env::temp_dir();
        path.push(format!(
            "tm_ops_{tag}_{}_{}",
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

async fn admin(state: &Arc<AppState>) -> Vec<String> {
    let csrf_reply = kirim(state.clone(), "GET", "/kasir/login", None, &[]).await;
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
    )
    .await;
    assert_eq!(reply.status, StatusCode::OK, "login admin: {}", reply.body);
    let mut semua = cookies_of(&reply);
    semua.push(format!("csrf_token={csrf}"));
    semua
}

async fn tunggu_backup(st: &Arc<AppState>, sesi: &[String], n: usize) -> Vec<Value> {
    for _ in 0..60 {
        let r = kirim(st.clone(), "GET", "/api/v1/kasir/backup/list", None, sesi).await;
        let arr = r.json()["backups"].as_array().cloned().unwrap_or_default();
        if arr.len() >= n {
            return arr;
        }
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }
    panic!("backup tidak selesai dalam waktu tunggu");
}

#[tokio::test]
async fn backup_manual_lalu_list_dan_hapus() {
    let (_dir, st) = state("backup").await;
    let sesi = admin(&st).await;
    let r = kirim(
        st.clone(),
        "POST",
        "/api/v1/kasir/backup/trigger",
        None,
        &sesi,
    )
    .await;
    assert_eq!(r.status, StatusCode::ACCEPTED, "{}", r.body);
    let daftar = tunggu_backup(&st, &sesi, 1).await;
    let nama = daftar[0]["filename"].as_str().unwrap().to_string();
    assert!(nama.starts_with("manual_backup_"), "{nama}");
    assert!(nama.ends_with(".zip"), "{nama}");
    let r = kirim(
        st.clone(),
        "DELETE",
        &format!("/api/v1/kasir/backup/delete/{nama}"),
        None,
        &sesi,
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert!(r.json()["success"].as_bool().unwrap());
}

#[tokio::test]
async fn restore_mengembalikan_data_dan_membuat_safety_backup() {
    let (_dir, st) = state("restore").await;
    let sesi = admin(&st).await;
    sqlx::query(
        "INSERT INTO menu_item (nama, harga, stok, is_active) VALUES ('Marker Uji', 1000, 1, 1)",
    )
    .execute(&st.pool)
    .await
    .unwrap();
    let r = kirim(
        st.clone(),
        "POST",
        "/api/v1/kasir/backup/trigger",
        None,
        &sesi,
    )
    .await;
    assert_eq!(r.status, StatusCode::ACCEPTED, "{}", r.body);
    let daftar = tunggu_backup(&st, &sesi, 1).await;
    let nama = daftar[0]["filename"].as_str().unwrap().to_string();
    sqlx::query("DELETE FROM menu_item WHERE nama = 'Marker Uji'")
        .execute(&st.pool)
        .await
        .unwrap();
    let tanpa_confirm = kirim(
        st.clone(),
        "POST",
        &format!("/api/v1/kasir/backup/restore/{nama}"),
        Some(json!({})),
        &sesi,
    )
    .await;
    assert_eq!(tanpa_confirm.status, StatusCode::BAD_REQUEST);
    assert_eq!(
        tanpa_confirm.json()["error"],
        "Konfirmasi restore diperlukan"
    );
    let r = kirim(
        st.clone(),
        "POST",
        &format!("/api/v1/kasir/backup/restore/{nama}"),
        Some(json!({"confirm": true})),
        &sesi,
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    let ada: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM menu_item WHERE nama = 'Marker Uji'")
        .fetch_one(&st.pool)
        .await
        .unwrap();
    assert_eq!(ada, 1, "data hasil backup harus kembali");
    let safety = r.json()["result"]["safety_backup"]
        .as_str()
        .unwrap_or("")
        .to_string();
    assert!(safety.starts_with("pre_restore_"), "{safety}");
}

#[tokio::test]
async fn statistik_database_dan_status_migrasi() {
    let (_dir, st) = state("stats").await;
    let sesi = admin(&st).await;
    let r = kirim(
        st.clone(),
        "GET",
        "/api/v1/kasir/settings/database/stats",
        None,
        &sesi,
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    let stats = &r.json()["stats"];
    assert!(stats["db_size_bytes"].as_i64().unwrap() > 0);
    assert!(stats["rows"]["pc"].as_i64().is_some());
    let r = kirim(
        st.clone(),
        "GET",
        "/api/v1/kasir/settings/migration/status",
        None,
        &sesi,
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert_eq!(r.json()["app_version"], "2.0.0");
}

#[tokio::test]
async fn ip_whitelist_tambah_toggle_dan_status() {
    let (_dir, st) = state("whitelist").await;
    let sesi = admin(&st).await;
    let kosong = kirim(
        st.clone(),
        "POST",
        "/api/v1/kasir/settings/ip-whitelist",
        Some(json!({"ip": ""})),
        &sesi,
    )
    .await;
    assert_eq!(kosong.status, StatusCode::BAD_REQUEST);
    assert_eq!(kosong.json()["error"], "IP address diperlukan.");
    let r = kirim(
        st.clone(),
        "POST",
        "/api/v1/kasir/settings/ip-whitelist",
        Some(json!({"ip": "10.10.10.10"})),
        &sesi,
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    let entries = r.json()["entries"].as_array().cloned().unwrap_or_default();
    assert!(entries
        .iter()
        .any(|e| e["ip"].as_str() == Some("10.10.10.10")));
    let r = kirim(
        st.clone(),
        "POST",
        "/api/v1/kasir/settings/ip-whitelist/toggle",
        Some(json!({"enabled": true})),
        &sesi,
    )
    .await;
    assert_eq!(r.status, StatusCode::OK, "{}", r.body);
    assert!(r.json()["enabled"].as_bool().unwrap());
}
