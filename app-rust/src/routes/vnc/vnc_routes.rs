//! Kontrol VNC kasir: status/start proxy server + orchestration per PC.

use axum::extract::{Path, State};
use axum::response::Response;
use serde_json::json;
use std::sync::Arc;

use crate::middleware::auth::{self, Kasir};
use crate::repositories::pc as pc_repo;
use crate::services::settings::settings_service;
use crate::services::vnc::vnc_service;
use crate::state::AppState;
use crate::utils::{http, logger};

type St = State<Arc<AppState>>;

pub async fn status(State(_state): St, kasir: Kasir) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    http::json(
        200,
        json!({
            "success": true,
            "data": {
                "vnc_server_active": vnc_service::is_port_open("127.0.0.1", vnc_service::VNC_PORT),
                "websockify_active": vnc_service::is_port_open("127.0.0.1", vnc_service::LISTEN_PORT),
                "listen_port": vnc_service::LISTEN_PORT,
            }
        }),
    )
}

pub async fn start(State(state): St, kasir: Kasir) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    let aktif = vnc_service::is_port_open("127.0.0.1", vnc_service::VNC_PORT);
    let password = settings_service::get_or_create_vnc_password(&state).await;
    vnc_service::ensure_listener(state.clone());
    logger::rec(
        &kasir.user.username,
        "VNC_START",
        &format!(
            "Proxy VNC dijalankan pada port {} (VNC server {})",
            vnc_service::LISTEN_PORT,
            if aktif { "aktif" } else { "tidak aktif" }
        ),
    );
    if !aktif {
        return http::json(
            400,
            json!({
                "success": false,
                "error": "VNC Server lokal (port 5900) tidak aktif.",
                "vnc_password": password,
            }),
        );
    }
    http::json(
        200,
        json!({
            "success": true,
            "message": "Proxy VNC siap",
            "listen_port": vnc_service::LISTEN_PORT,
            "token": "server",
            "vnc_password": password,
        }),
    )
}

pub async fn client_start(State(state): St, kasir: Kasir, Path(pc_id): Path<i64>) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    let pc = match pc_repo::get_by_id(&state.pool, pc_id).await {
        Ok(Some(pc)) => pc,
        _ => {
            return http::json(
                404,
                json!({"success": false, "error": "PC tidak ditemukan"}),
            )
        }
    };
    let password = settings_service::get_or_create_vnc_password(&state).await;
    if let Some(p) = state.vnc.get(pc.id) {
        return http::json(
            200,
            json!({
                "success": true,
                "message": "Remote control sudah aktif",
                "port": p.port,
                "token": p.token,
                "vnc_password": password,
                "pc_kode": pc.kode,
            }),
        );
    }
    state.vnc.reset(pc.id);
    state.commands.fast.push_json(
        pc.id,
        json!({"type": "vnc_start", "vnc_password": password}),
    );
    logger::rec(
        &kasir.user.username,
        "VNC_COMMAND_QUEUED",
        &format!("Perintah VNC START masuk antrean untuk PC {}", pc.kode),
    );
    // Monitor klien bisa telat/mati; bila TightVNC sudah hidup, buka proxy sekarang.
    let host = pc.ip_address.clone().unwrap_or_default();
    if vnc_service::is_port_open(&host, vnc_service::VNC_PORT) {
        if let Ok(p) = vnc_service::start_proxy(&state, pc.id, &host) {
            logger::rec(
                &kasir.user.username,
                "VNC_PROXY_START",
                &format!("Proxy VNC langsung aktif untuk PC {} ({host})", pc.kode),
            );
            return http::json(
                200,
                json!({
                    "success": true,
                    "pending": false,
                    "message": "Remote control siap",
                    "port": p.port,
                    "token": p.token,
                    "vnc_password": password,
                    "pc_kode": pc.kode,
                }),
            );
        }
    }
    http::json(
        202,
        json!({
            "success": true,
            "pending": true,
            "message": "Perintah VNC dikirim, menunggu respon PC",
            "vnc_password": password,
            "pc_kode": pc.kode,
        }),
    )
}

pub async fn client_stop(State(state): St, kasir: Kasir, Path(pc_id): Path<i64>) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    let pc = match pc_repo::get_by_id(&state.pool, pc_id).await {
        Ok(Some(pc)) => pc,
        _ => {
            return http::json(
                404,
                json!({"success": false, "error": "PC tidak ditemukan"}),
            )
        }
    };
    vnc_service::stop_proxy(&state, pc.id);
    logger::rec(
        &kasir.user.username,
        "VNC_CLIENT_STOP",
        &format!("Proxy VNC client PC {} dihentikan", pc.kode),
    );
    http::json(
        200,
        json!({"success": true, "message": "Remote control berhasil dihentikan"}),
    )
}

pub async fn client_status(State(state): St, kasir: Kasir, Path(pc_id): Path<i64>) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    if state.vnc.get(pc_id).is_none() {
        match state.vnc.poll(pc_id) {
            Some(Err(e)) => return http::json(408, json!({"success": false, "error": e})),
            Some(Ok(())) => {
                let pc = match pc_repo::get_by_id(&state.pool, pc_id).await {
                    Ok(Some(pc)) => pc,
                    _ => {
                        return http::json(
                            404,
                            json!({"success": false, "error": "PC tidak ditemukan"}),
                        )
                    }
                };
                // Agent yang baru siap dipakai alamatnya dari DB (cache IP tidak menyimpan IP).
                let host = pc.ip_address.clone().unwrap_or_default();
                match vnc_service::start_proxy(&state, pc.id, &host) {
                    Ok(p) => logger::rec(
                        &kasir.user.username,
                        "VNC_CLIENT_START",
                        &format!(
                            "Proxy VNC client PC {} dimulai pada port {}",
                            pc.kode, p.port
                        ),
                    ),
                    Err(e) => {
                        return http::json(
                            500,
                            json!({"success": false, "error": format!("Gagal mengaktifkan proxy server: {e}")}),
                        )
                    }
                }
            }
            None => {}
        }
    }
    // Fallback: monitor klien mungkin tidak sempat mengirim vnc_ready; probe langsung.
    if state.vnc.get(pc_id).is_none() {
        if let Ok(Some(pc)) = pc_repo::get_by_id(&state.pool, pc_id).await {
            let host = pc.ip_address.clone().unwrap_or_default();
            if vnc_service::is_port_open(&host, vnc_service::VNC_PORT) {
                let _ = vnc_service::start_proxy(&state, pc.id, &host);
            }
        }
    }
    match state.vnc.get(pc_id) {
        Some(p) => http::json(
            200,
            json!({
                "success": true,
                "active": true,
                "port": p.port,
                "token": p.token,
                "client_ip": p.client_ip,
            }),
        ),
        None => http::json(200, json!({"success": true, "active": false})),
    }
}
