//! Rute client agent: `/api/v1/public/client` (API key wajib di header `X-Client-Key`).

use axum::body::Bytes;
use axum::extract::{ConnectInfo, State};
use axum::http::HeaderMap;
use axum::response::Response;
use hmac::{Hmac, Mac};
use serde_json::{json, Value};
use sha2::Sha256;
use std::net::SocketAddr;
use std::sync::Arc;

use crate::services::client::client_service;
use crate::services::settings::settings_service;
use crate::state::AppState;
use crate::utils::http;
use crate::utils::logger;

type St = State<Arc<AppState>>;

pub(crate) fn kunci_sama(kirim: &str, harapan: &str) -> bool {
    if kirim.is_empty() || harapan.is_empty() {
        return false;
    }
    let mut mac = Hmac::<Sha256>::new_from_slice(harapan.as_bytes()).unwrap();
    mac.update(kirim.as_bytes());
    let mut pembanding = Hmac::<Sha256>::new_from_slice(harapan.as_bytes()).unwrap();
    pembanding.update(harapan.as_bytes());
    mac.verify_slice(&pembanding.finalize().into_bytes())
        .is_ok()
}

/// IP peer: header proxy hanya dipercaya dari loopback.
pub(crate) fn peer_ip(headers: &HeaderMap, peer: SocketAddr) -> String {
    let remote = peer.ip().to_string();
    if headers.get("host").is_some() && (peer.ip().is_loopback()) {
        for name in ["cf-connecting-ip", "x-forwarded-for"] {
            if let Some(v) = headers.get(name).and_then(|v| v.to_str().ok()) {
                let first = v.split(',').next().unwrap_or("").trim();
                if !first.is_empty() {
                    return first.to_string();
                }
            }
        }
    }
    remote
}

fn ip_client(data: &Value, peer: &str) -> Result<String, String> {
    let mut claimed = data
        .get("ip_address")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if claimed.eq_ignore_ascii_case("unknown") {
        claimed.clear();
    }
    if peer == "127.0.0.1" || peer == "::1" || peer == "localhost" {
        return Ok(if claimed.is_empty() {
            peer.to_string()
        } else {
            claimed
        });
    }
    if !claimed.is_empty() && claimed != peer {
        return Err("IP client tidak cocok dengan koneksi".into());
    }
    Ok(peer.to_string())
}

fn mac_of(data: &Value) -> String {
    data.get("mac_address")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_uppercase()
        .trim()
        .to_string()
}

async fn gerbang(st: &AppState, headers: &HeaderMap, peer: &str) -> Result<(), Response> {
    let kirim = headers
        .get("x-client-key")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let harapan = settings_service::client_api_key(st).await;
    if !kunci_sama(kirim, &harapan) {
        logger::rec(
            "system",
            "API_KEY_GAGAL",
            &format!("Invalid/Missing API Key from {peer}"),
        );
        let pc_id = st
            .pc_network
            .resolve(&st.pool, peer, None)
            .await
            .ok()
            .flatten()
            .map(|m| m.id);
        st.mismatch.record(peer, pc_id);
        return Err(http::json(
            401,
            json!({"error": "Akses ditolak. API Key tidak valid atau belum dikonfigurasi"}),
        ));
    }
    let pc_id = st
        .pc_network
        .resolve(&st.pool, peer, None)
        .await
        .ok()
        .flatten()
        .map(|m| m.id);
    st.mismatch.clear(peer, pc_id);
    Ok(())
}

fn salah(status: u16, msg: impl Into<String>) -> Response {
    http::json(status, json!({"success": false, "error": msg.into()}))
}

pub async fn identify(
    State(state): St,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let peer = peer_ip(&headers, peer);
    if let Err(res) = gerbang(&state, &headers, &peer).await {
        return res;
    }
    let data = http::parse_json(&body);
    let ip = match ip_client(&data, &peer) {
        Ok(v) => v,
        Err(e) => return http::json(400, json!({"valid": false, "error": e})),
    };
    match client_service::identify(&state, &ip, &mac_of(&data)).await {
        Ok(v) => http::json(200, v),
        Err(e) => http::json(400, json!({"valid": false, "error": e})),
    }
}

pub async fn status(
    State(state): St,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let peer = peer_ip(&headers, peer);
    if let Err(res) = gerbang(&state, &headers, &peer).await {
        return res;
    }
    let data = http::parse_json(&body);
    let ip = match ip_client(&data, &peer) {
        Ok(v) => v,
        Err(e) => return http::json(400, json!({"error": e})),
    };
    let role = data.get("role").and_then(|v| v.as_str());
    match client_service::status(&state, &ip, &mac_of(&data), role).await {
        Ok(v) => http::json(200, v),
        Err(e) => http::json(400, json!({"error": e})),
    }
}

pub async fn selesai(
    State(state): St,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let peer = peer_ip(&headers, peer);
    if let Err(res) = gerbang(&state, &headers, &peer).await {
        return res;
    }
    let data = http::parse_json(&body);
    let ip = match ip_client(&data, &peer) {
        Ok(v) => v,
        Err(e) => return http::json(400, json!({"error": e})),
    };
    match client_service::selesai(&state, &ip, &mac_of(&data)).await {
        Ok(v) => http::json(200, v),
        Err(e) => http::json(400, json!({"error": e})),
    }
}

pub async fn admin_login(
    State(state): St,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let peer = peer_ip(&headers, peer);
    if let Err(res) = gerbang(&state, &headers, &peer).await {
        return res;
    }
    let data = http::parse_json(&body);
    let ip = match ip_client(&data, &peer) {
        Ok(v) => v,
        Err(e) => return salah(400, e),
    };
    let username = data
        .get("username")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim();
    let password = data.get("password").and_then(|v| v.as_str()).unwrap_or("");
    let agent = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    match client_service::admin_login(
        &state,
        &ip,
        &mac_of(&data),
        username,
        password,
        &peer,
        agent,
    )
    .await
    {
        Ok(v) => http::json(200, v),
        Err(e) if e.starts_with("Terlalu banyak") => salah(429, e),
        Err(e) => salah(400, e),
    }
}

pub async fn emergency_login(
    State(state): St,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let peer = peer_ip(&headers, peer);
    if let Err(res) = gerbang(&state, &headers, &peer).await {
        return res;
    }
    let data = http::parse_json(&body);
    let ip = match ip_client(&data, &peer) {
        Ok(v) => v,
        Err(e) => return salah(400, e),
    };
    let username = data
        .get("username")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("SYSTEM");
    let token = data.get("token").and_then(|v| v.as_str());
    match client_service::emergency_login(&state, &ip, &mac_of(&data), username, token, &peer).await
    {
        Ok(v) => http::json(200, v),
        Err(e) if e.starts_with("TOKEN:") => salah(403, e.trim_start_matches("TOKEN:")),
        Err(e) => salah(400, e),
    }
}

pub async fn afk_lock(
    State(state): St,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let peer = peer_ip(&headers, peer);
    if let Err(res) = gerbang(&state, &headers, &peer).await {
        return res;
    }
    let data = http::parse_json(&body);
    let ip = match ip_client(&data, &peer) {
        Ok(v) => v,
        Err(e) => return salah(400, e),
    };
    let pin = data.get("pin").and_then(|v| v.as_str());
    match client_service::afk_lock(&state, &ip, &mac_of(&data), pin).await {
        Ok(v) => http::json(200, v),
        Err(e) => salah(400, e),
    }
}

pub async fn afk_unlock(
    State(state): St,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let peer = peer_ip(&headers, peer);
    if let Err(res) = gerbang(&state, &headers, &peer).await {
        return res;
    }
    let data = http::parse_json(&body);
    let ip = match ip_client(&data, &peer) {
        Ok(v) => v,
        Err(e) => return salah(400, e),
    };
    let credential = data
        .get("credential")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    match client_service::afk_unlock(&state, &ip, &mac_of(&data), credential).await {
        Ok(v) => http::json(200, v),
        Err(e) if e.starts_with("KREDENSIAL:") => salah(401, e.trim_start_matches("KREDENSIAL:")),
        Err(e) => salah(400, e),
    }
}

pub async fn warnet(
    State(state): St,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
) -> Response {
    let peer = peer_ip(&headers, peer);
    if let Err(res) = gerbang(&state, &headers, &peer).await {
        return res;
    }
    let host = headers
        .get("host")
        .and_then(|v| v.to_str().ok())
        .map(|h| format!("http://{h}"))
        .unwrap_or_else(|| "http://127.0.0.1:7015".to_string());
    http::json(200, client_service::warnet_config(&state, &host).await)
}

async fn pc_id_dari(st: &AppState, ip: &str, mac: &str) -> Option<(i64, String)> {
    if let Ok(Some(meta)) = st.pc_network.resolve(&st.pool, ip, Some(mac)).await {
        return Some((meta.id, meta.kode));
    }
    if let Ok(Some(pc)) = crate::repositories::pc::find_aktif_by_ip(&st.pool, ip).await {
        return Some((pc.id, pc.kode));
    }
    let m = mac.replace([':', '-', ' '], "").to_uppercase();
    if let Ok(Some(pc)) = crate::repositories::pc::find_by_mac(&st.pool, &m).await {
        return Some((pc.id, pc.kode));
    }
    None
}

pub async fn fast_poll(
    State(state): St,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let peer = peer_ip(&headers, peer);
    if let Err(res) = gerbang(&state, &headers, &peer).await {
        return res;
    }
    let data = http::parse_json(&body);
    let ip = match ip_client(&data, &peer) {
        Ok(v) => v,
        Err(e) => return salah(400, e),
    };
    let Some((pc_id, kode)) = pc_id_dari(&state, &ip, &mac_of(&data)).await else {
        return salah(404, "PC tidak dikenal");
    };
    let cmd = state.commands.fast.pop(pc_id);
    if let Some(c) = &cmd {
        logger::rec(
            "system",
            "FAST_COMMAND_DISPATCHED",
            &format!("Perintah cepat [{c}] diambil oleh PC {kode} ({ip})"),
        );
    }
    // Klien mem-parse objek JSON (vnc_start) dari field ini; kalau dikirim sebagai
    // string, cabang as_str() menang dan perintah VNC tidak pernah dieksekusi.
    let command = cmd.map(|c| {
        serde_json::from_str::<serde_json::Value>(&c).unwrap_or(serde_json::Value::String(c))
    });
    http::json(200, json!({"success": true, "command": command}))
}

pub async fn vnc_ready(
    State(state): St,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let peer = peer_ip(&headers, peer);
    if let Err(res) = gerbang(&state, &headers, &peer).await {
        return res;
    }
    let data = http::parse_json(&body);
    let ip = match ip_client(&data, &peer) {
        Ok(v) => v,
        Err(e) => return salah(400, e),
    };
    let Some((_, kode)) = pc_id_dari(&state, &ip, &mac_of(&data)).await else {
        logger::rec(
            "system",
            "VNC_READY_REJECTED",
            &format!("Laporan VNC ready ditolak: PC tidak dikenal (IP={ip})"),
        );
        return salah(404, "PC tidak dikenal");
    };
    let ready = data.get("ready").and_then(|v| v.as_bool()).unwrap_or(true);
    if ready {
        logger::rec(
            "system",
            "VNC_CLIENT_READY",
            &format!("Client PC {kode} melaporkan VNC server aktif di port 5900"),
        );
    } else {
        let err = data.get("error").and_then(|v| v.as_str()).unwrap_or("-");
        logger::rec(
            "system",
            "VNC_CLIENT_FAILED",
            &format!("Client PC {kode} gagal mengaktifkan VNC: {err}"),
        );
    }
    http::json(
        200,
        json!({"success": true, "message": "Status VNC ready diperbarui"}),
    )
}

pub async fn vnc_stopped(
    State(state): St,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let peer = peer_ip(&headers, peer);
    if let Err(res) = gerbang(&state, &headers, &peer).await {
        return res;
    }
    let data = http::parse_json(&body);
    let ip = match ip_client(&data, &peer) {
        Ok(v) => v,
        Err(e) => return salah(400, e),
    };
    let Some((_, kode)) = pc_id_dari(&state, &ip, &mac_of(&data)).await else {
        return salah(404, "PC tidak dikenal");
    };
    logger::rec(
        "system",
        "VNC_CLIENT_STOPPED",
        &format!("Client PC {kode} melaporkan VNC server telah dihentikan"),
    );
    http::json(
        200,
        json!({"success": true, "message": "Status VNC stopped diperbarui"}),
    )
}
