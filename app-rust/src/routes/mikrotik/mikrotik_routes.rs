//! Konfigurasi & sinkronisasi MikroTik hotspot.

use axum::body::Bytes;
use axum::extract::State;
use axum::response::Response;
use serde_json::json;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use crate::middleware::auth::{self, Kasir};
use crate::repositories::mikrotik as cfg_repo;
use crate::services::mikrotik::mikrotik_service::{sync_members, Client};
use crate::state::AppState;
use crate::utils::{http, logger, validators};

type St = State<Arc<AppState>>;

static SYNC_RUNNING: AtomicBool = AtomicBool::new(false);

pub async fn get_config(State(state): St, kasir: Kasir) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    match cfg_repo::get_instance(&state.pool).await {
        Ok(c) => http::json(
            200,
            json!({"success": true, "data": {
                "enabled": c.enabled,
                "host": c.host.unwrap_or_default(),
                "port": c.port,
                "username": c.username.unwrap_or_default(),
                "password": c.password.unwrap_or_default(),
                "hotspot_profile": c.hotspot_profile.unwrap_or_else(|| "default".into()),
            }}),
        ),
        Err(e) => http::json(500, json!({"error": e.to_string()})),
    }
}

pub async fn save_config(State(state): St, kasir: Kasir, body: Bytes) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    let data = http::parse_json(&body);
    let cfg = match cfg_repo::get_instance(&state.pool).await {
        Ok(c) => c,
        Err(e) => return http::json(500, json!({"error": e.to_string()})),
    };
    let enabled = data
        .get("enabled")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let host = data
        .get("host")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    let username = data
        .get("username")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    let host = if enabled {
        match validators::text(&host, 1, 255, "Host MikroTik", true) {
            Ok(v) => v,
            Err(e) => return http::json(400, json!({"error": e})),
        }
    } else {
        host
    };
    let username = if enabled {
        match validators::text(&username, 1, 64, "Username MikroTik", true) {
            Ok(v) => v,
            Err(e) => return http::json(400, json!({"error": e})),
        }
    } else {
        username
    };
    let port = match validators::int_range(
        data.get("port").unwrap_or(&json!(8728)),
        1,
        65535,
        "Port MikroTik",
    ) {
        Ok(v) => v,
        Err(e) => return http::json(400, json!({"error": e})),
    };
    let password = data
        .get("password")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    let profile = match validators::text(
        data.get("hotspot_profile")
            .and_then(|v| v.as_str())
            .unwrap_or("default"),
        1,
        64,
        "Profile Hotspot",
        false,
    ) {
        Ok(v) if v.is_empty() => "default".to_string(),
        Ok(v) => v,
        Err(e) => return http::json(400, json!({"error": e})),
    };
    match cfg_repo::save(
        &state.pool,
        cfg.id,
        enabled,
        &host,
        port as i64,
        &username,
        password.as_deref(),
        &profile,
    )
    .await
    {
        Ok(()) => {
            logger::rec(
                &kasir.user.username,
                "MIKROTIK_CONFIG",
                &format!("Konfigurasi MikroTik diperbarui (Enabled: {enabled})"),
            );
            http::json(
                200,
                json!({"success": true, "message": "Pengaturan MikroTik berhasil disimpan"}),
            )
        }
        Err(e) => http::json(500, json!({"error": e.to_string()})),
    }
}

pub async fn test(State(state): St, kasir: Kasir, body: Bytes) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    let _ = state;
    let data = http::parse_json(&body);
    let host = data.get("host").and_then(|v| v.as_str()).unwrap_or("");
    let username = data.get("username").and_then(|v| v.as_str()).unwrap_or("");
    if host.is_empty() || username.is_empty() {
        return http::json(400, json!({"error": "Host dan Username wajib diisi"}));
    }
    let port = match validators::int_range(
        data.get("port").unwrap_or(&json!(8728)),
        1,
        65535,
        "Port MikroTik",
    ) {
        Ok(v) => v as u16,
        Err(e) => return http::json(400, json!({"error": e})),
    };
    let password = data.get("password").and_then(|v| v.as_str()).unwrap_or("");
    let mut client = Client::new(host, username, password, port);
    let (ok, msg) = client.test_connection();
    let _ = kasir;
    if ok {
        http::json(200, json!({"success": true, "message": msg}))
    } else {
        http::json(400, json!({"error": msg}))
    }
}

pub async fn sync_all(State(state): St, kasir: Kasir) -> Response {
    if let Err(res) = auth::admin_only(&kasir) {
        return res;
    }
    let cfg = match cfg_repo::get_instance(&state.pool).await {
        Ok(c) => c,
        Err(e) => return http::json(500, json!({"error": e.to_string()})),
    };
    if !cfg.enabled {
        return http::json(
            400,
            json!({"error": "Integrasi MikroTik belum diaktifkan."}),
        );
    }
    if SYNC_RUNNING.swap(true, Ordering::SeqCst) {
        return http::json(
            409,
            json!({"error": "Sinkronisasi massal sedang berjalan."}),
        );
    }
    let host = cfg.host.clone().unwrap_or_default();
    let username = cfg.username.clone().unwrap_or_default();
    let password = cfg.password.clone().unwrap_or_default();
    let profile = cfg
        .hotspot_profile
        .clone()
        .unwrap_or_else(|| "default".into());
    let port = cfg.port as u16;
    let mut client = Client::new(&host, &username, &password, port);
    let (ok, msg) = client.test_connection();
    if !ok {
        SYNC_RUNNING.store(false, Ordering::SeqCst);
        return http::json(400, json!({"error": format!("Koneksi gagal: {msg}")}));
    }
    let members: Vec<String> = sqlx::query_scalar("SELECT username FROM member")
        .fetch_all(&state.pool)
        .await
        .unwrap_or_default();
    let jumlah = members.len();
    tokio::spawn(async move {
        // Reset lock juga saat task panik.
        struct Guard;
        impl Drop for Guard {
            fn drop(&mut self) {
                SYNC_RUNNING.store(false, Ordering::SeqCst);
            }
        }
        let _guard = Guard;
        let mut client = Client::new(&host, &username, &password, port);
        match client.login() {
            Ok(()) => {
                let (berhasil, gagal) = sync_members(&mut client, &members, &profile);
                logger::rec(
                    "system",
                    "MIKROTIK_SYNC",
                    &format!(
                        "Sinkronisasi massal selesai. {berhasil} berhasil, {gagal} gagal dari {jumlah} member."
                    ),
                );
            }
            Err(e) => logger::rec(
                "system",
                "MIKROTIK_ERROR",
                &format!("Gagal login saat sinkronisasi massal: {e}"),
            ),
        }
    });
    logger::rec(
        &kasir.user.username,
        "MIKROTIK_SYNC",
        &format!("Sinkronisasi massal {jumlah} member berjalan di latar belakang"),
    );
    http::json(
        200,
        json!({"success": true, "message": format!("Sinkronisasi massal {jumlah} member sedang berjalan di latar belakang.")}),
    )
}
