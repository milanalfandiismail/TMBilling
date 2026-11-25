//! IP whitelist, URL publik, dan Cloudflare Tunnel.

use crate::middleware::auth::{admin_only, Kasir};
use crate::services::settings::ip_whitelist as wl;
use crate::services::settings::settings_service as settings;
use crate::state::AppState;
use crate::utils::http;
use axum::{extract::State, http::HeaderMap, response::Response};
use serde_json::{json, Value};
use std::sync::Arc;

pub async fn list_whitelist(State(st): State<Arc<AppState>>, k: Kasir) -> Response {
    if let Err(res) = admin_only(&k) {
        return res;
    }
    http::json(200, json!({"entries": wl::entries(&st).await}))
}

pub async fn add_whitelist(
    State(st): State<Arc<AppState>>,
    k: Kasir,
    connect: axum::extract::ConnectInfo<std::net::SocketAddr>,
    body: axum::body::Bytes,
) -> Response {
    let _ = connect;
    if let Err(res) = admin_only(&k) {
        return res;
    }
    let data = http::parse_json(&body);
    let ip = data.get("ip").and_then(|v| v.as_str()).unwrap_or("").trim();
    if ip.is_empty() {
        return http::json(400, json!({"error": "IP address diperlukan."}));
    }
    let label = data.get("label").and_then(|v| v.as_str()).unwrap_or("");
    let ip = ip.to_string();
    match wl::add(&st, &ip, label).await {
        Ok(_) => http::json(
            200,
            json!({"success": true, "entries": wl::entries(&st).await}),
        ),
        Err(e) => http::json(400, json!({"error": e})),
    }
}

pub async fn remove_whitelist(
    State(st): State<Arc<AppState>>,
    k: Kasir,
    axum::extract::Path(ip): axum::extract::Path<String>,
) -> Response {
    if let Err(res) = admin_only(&k) {
        return res;
    }
    match wl::remove(&st, &ip).await {
        Ok(_) => http::json(
            200,
            json!({"success": true, "entries": wl::entries(&st).await}),
        ),
        Err(e) => http::json(400, json!({"error": e})),
    }
}

pub async fn toggle_whitelist(
    State(st): State<Arc<AppState>>,
    k: Kasir,
    body: axum::body::Bytes,
) -> Response {
    if let Err(res) = admin_only(&k) {
        return res;
    }
    let data = http::parse_json(&body);
    let enabled = data
        .get("enabled")
        .map(|v| v.as_bool().unwrap_or_else(|| v.as_str() == Some("true")))
        .unwrap_or(!wl::is_enabled(&st).await);
    if let Err(e) = wl::set_enabled(&st, enabled).await {
        return http::json(500, json!({"error": e.to_string()}));
    }
    http::json(200, json!({"success": true, "enabled": enabled}))
}

pub async fn regenerate_token(State(st): State<Arc<AppState>>, k: Kasir) -> Response {
    if let Err(res) = admin_only(&k) {
        return res;
    }
    match wl::regenerate_token(&st).await {
        Ok((token, version)) => http::json(
            200,
            json!({"success": true, "token": token, "version": version}),
        ),
        Err(e) => http::json(500, json!({"error": e.to_string()})),
    }
}

pub async fn whitelist_status(
    State(st): State<Arc<AppState>>,
    k: Kasir,
    headers: HeaderMap,
    connect: axum::extract::ConnectInfo<std::net::SocketAddr>,
) -> Response {
    if let Err(res) = admin_only(&k) {
        return res;
    }
    let token = wl::token(&st).await;
    let base = settings::get_or(&st, "app_public_url", "")
        .await
        .trim()
        .trim_end_matches('/')
        .to_string();
    let base = if base.is_empty() {
        format!("http://{}", connect.0)
    } else {
        base
    };
    http::json(
        200,
        json!({
            "enabled": wl::is_enabled(&st).await,
            "current_ip": crate::middleware::whitelist::client_ip(&headers, Some(connect.0)),
            "token_masked": wl::token_masked(&st).await,
            "full_url": format!("{base}/kasir/?token={token}"),
        }),
    )
}

pub async fn set_app_public_url(
    State(st): State<Arc<AppState>>,
    k: Kasir,
    body: axum::body::Bytes,
) -> Response {
    if let Err(res) = admin_only(&k) {
        return res;
    }
    let data = http::parse_json(&body);
    let url = data
        .get("url")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if let Err(e) = settings::set(&st, "app_public_url", &url).await {
        return http::json(500, json!({"error": e.to_string()}));
    }
    http::json(200, json!({"success": true, "url": url}))
}

fn cloudflared_exe(st: &AppState) -> std::path::PathBuf {
    st.cfg.root.join("bin").join("cloudflared.exe")
}

pub async fn tunnel_status(State(st): State<Arc<AppState>>, k: Kasir) -> Response {
    if let Err(res) = admin_only(&k) {
        return res;
    }
    let running = {
        let mut guard = st.cloudflared.lock().unwrap_or_else(|e| e.into_inner());
        match guard.as_mut() {
            Some(child) => match child.try_wait() {
                Ok(Some(_)) => {
                    *guard = None;
                    false
                }
                Ok(None) => true,
                Err(_) => false,
            },
            None => false,
        }
    };
    let token = settings::get(&st, "cloudflare_tunnel_token")
        .await
        .unwrap_or_default();
    http::json(
        200,
        json!({
            "success": true,
            "status": {"running": running, "configured": !token.is_empty(), "binary": cloudflared_exe(&st).is_file()},
        }),
    )
}

pub async fn save_tunnel_token(
    State(st): State<Arc<AppState>>,
    k: Kasir,
    body: axum::body::Bytes,
) -> Response {
    if let Err(res) = admin_only(&k) {
        return res;
    }
    let data = http::parse_json(&body);
    let token = data
        .get("token")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if let Err(e) = settings::set(&st, "cloudflare_tunnel_token", &token).await {
        return http::json(500, json!({"success": false, "error": e.to_string()}));
    }
    crate::utils::logger::rec(
        "admin",
        "CLOUDFLARE_TOKEN",
        "Token Cloudflare Tunnel diperbarui",
    );
    http::json(
        200,
        json!({"success": true, "message": "Token Cloudflare Tunnel berhasil disimpan"}),
    )
}

pub async fn toggle_tunnel(
    State(st): State<Arc<AppState>>,
    k: Kasir,
    body: axum::body::Bytes,
) -> Response {
    if let Err(res) = admin_only(&k) {
        return res;
    }
    let data = http::parse_json(&body);
    let enable = data.get("enable").and_then(|v| v.as_bool()).unwrap_or(true);
    let exe = cloudflared_exe(&st);
    if enable {
        let token = settings::get(&st, "cloudflare_tunnel_token")
            .await
            .unwrap_or_default();
        if token.is_empty() {
            return http::json(
                400,
                json!({"success": false, "error": "Token Cloudflare Tunnel belum diisi"}),
            );
        }
        if !exe.is_file() {
            return http::json(
                400,
                json!({"success": false, "error": "Biner cloudflared.exe tidak ditemukan di folder bin"}),
            );
        }
        let mut guard = st.cloudflared.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(child) = guard.as_mut() {
            match child.try_wait() {
                Ok(None) => {
                    return http::json(
                        200,
                        json!({"success": true, "message": "Tunnel sudah berjalan", "running": true}),
                    );
                }
                _ => {
                    *guard = None;
                }
            }
        }
        match std::process::Command::new(&exe)
            .args(["tunnel", "--no-autoupdate", "run", "--token", &token])
            .current_dir(
                exe.parent()
                    .map(|p| p.to_path_buf())
                    .unwrap_or_else(|| st.cfg.root.clone()),
            )
            .spawn()
        {
            Ok(child) => {
                *guard = Some(child);
                http::json(
                    200,
                    json!({"success": true, "message": "Tunnel dijalankan", "running": true}),
                )
            }
            Err(e) => http::json(400, json!({"success": false, "error": e.to_string()})),
        }
    } else {
        let mut guard = st.cloudflared.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
        }
        http::json(
            200,
            json!({"success": true, "message": "Tunnel dihentikan", "running": false}),
        )
    }
}

pub fn _unused(_: Value) {}
