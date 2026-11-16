//! Kontrak HTTP shell: health, aset embed, dan guard whitelist.

use axum::body::Body;
use axum::extract::ConnectInfo;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use tmbilling_server::app::router;
use tmbilling_server::config::Config;
use tmbilling_server::repositories::settings as settings_repo;
use tmbilling_server::state::AppState;
use tower::ServiceExt;

struct TempDir(PathBuf);

impl TempDir {
    fn new(tag: &str) -> Self {
        let mut path = std::env::temp_dir();
        path.push(format!(
            "tm_http_{tag}_{}_{}",
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
    let st = AppState::new(cfg).await.unwrap();
    (dir, Arc::new(st))
}

async fn get(st: Arc<AppState>, uri: &str, peer: SocketAddr) -> (StatusCode, String) {
    let mut req = Request::builder().uri(uri).body(Body::empty()).unwrap();
    req.extensions_mut().insert(ConnectInfo(peer));
    let res = router(st).oneshot(req).await.unwrap();
    let status = res.status();
    let body = res.into_body().collect().await.unwrap().to_bytes();
    (status, String::from_utf8_lossy(&body).to_string())
}

const LAN: SocketAddr = SocketAddr::new(
    std::net::IpAddr::V4(std::net::Ipv4Addr::new(192, 168, 1, 50)),
    5000,
);
const LOCAL: SocketAddr = SocketAddr::new(
    std::net::IpAddr::V4(std::net::Ipv4Addr::new(127, 0, 0, 1)),
    5000,
);

#[tokio::test]
async fn health_tanpa_angka_atau_path() {
    let (_dir, st) = state("health").await;
    let (status, body) = get(st, "/api/health", LAN).await;
    assert_eq!(status, StatusCode::OK);
    assert!(body.contains("\"status\""));
    assert!(body.contains("\"db\"") && body.contains("\"disk\"") && body.contains("\"backup\""));
    assert!(
        !body.contains("warnet.db"),
        "path database tidak boleh bocor: {body}"
    );
}

#[tokio::test]
async fn aset_statis_di_embed_dengan_cache_setahun() {
    let (_dir, st) = state("static").await;
    let mut req = Request::builder()
        .uri("/static/css/tailwind.css?v=200")
        .body(Body::empty())
        .unwrap();
    req.extensions_mut().insert(ConnectInfo(LAN));
    let res = router(st).oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    assert_eq!(
        res.headers().get("cache-control").unwrap(),
        "public, max-age=31536000, immutable"
    );
    assert!(res
        .headers()
        .get("content-type")
        .unwrap()
        .to_str()
        .unwrap()
        .starts_with("text/css"));
}

#[tokio::test]
async fn kasir_diblokir_bila_ip_tidak_ada_di_whitelist() {
    let (_dir, st) = state("blocked").await;
    // Halaman HTML: dialihkan ke login, bukan 403 mentah.
    let (status, _) = get(st.clone(), "/kasir/", LAN).await;
    assert_eq!(status, StatusCode::FOUND);
    // API: 403 JSON berisi IP penolak.
    let (status, body) = get(st, "/api/v1/kasir/dashboard", LAN).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert!(body.contains("192.168.1.50"), "{body}");
}

#[tokio::test]
async fn whitelist_mengizinkan_ip_terdaftar_dan_bypass_login() {
    let (_dir, st) = state("allowed").await;
    settings_repo::set(&st.pool, "ip_whitelist", "[{\"ip\":\"192.168.1.50\"}]")
        .await
        .unwrap();
    st.settings.invalidate();
    // Halaman login harus tersaji (bukan 403) untuk IP yang diizinkan.
    let (status, body) = get(st.clone(), "/kasir/login", LAN).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    // wholescope check: rute api di luar whitelist → 403 JSON dengan field ip
    let (status, body) = get(
        st,
        "/api/v1/kasir/whatever",
        SocketAddr::new(
            std::net::IpAddr::V4(std::net::Ipv4Addr::new(192, 168, 1, 99)),
            5000,
        ),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert!(body.contains("\"error\":\"forbidden\""));
}
