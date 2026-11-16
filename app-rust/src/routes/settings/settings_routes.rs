//! Pengaturan umum: baca semua (redaksi per role), tulis per key, API key, timezone.

use crate::middleware::auth::{admin_only, Kasir};
use crate::services::settings::{ip_whitelist, settings_service};
use crate::state::AppState;
use crate::utils::{http, validators};
use axum::body::Bytes;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde_json::{json, Value};
use std::sync::Arc;

const CASHIER_SAFE_SETTINGS: [&str; 1] = ["payment_methods"];
const GENERIC_PREFIXES: [&str; 7] = [
    "warnet_",
    "backup_",
    "tv_",
    "qris_",
    "mikrotik_",
    "screenshot_",
    "ip_whitelist",
];
const GENERIC_KEYS: [&str; 1] = ["payment_methods"];

fn audit(user: &str, action: &str, detail: &str, extra: Option<Value>) {
    match extra {
        Some(value) => crate::utils::logger::audit_json(user, action, detail, None, "", "", value),
        None => crate::utils::logger::audit(user, action, detail, None, "", ""),
    }
}

pub async fn get_all(State(state): State<Arc<AppState>>, kasir: Kasir) -> Response {
    let mut data = settings_service::get_all(&state).await;
    if kasir.user.role() == "admin" {
        data.insert(
            "client_api_key".into(),
            settings_service::client_api_key(&state).await,
        );
    } else {
        // shortcut: key baru yang perlu dibaca kasir harus ditambahkan ke daftar ini
        data.retain(|k, _| CASHIER_SAFE_SETTINGS.contains(&k.as_str()));
    }
    http::json(200, json!({"success": true, "settings": data}))
}

pub async fn auto_shutdown(
    State(state): State<Arc<AppState>>,
    kasir: Kasir,
    body: Bytes,
) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let data = http::parse_json(&body);
    if data.is_null() {
        return http::err(400, "Request body diperlukan");
    }
    let timer = match validators::int_range(
        data.get("timer_seconds").unwrap_or(&Value::Null),
        30,
        600,
        "Timer Auto-Shutdown",
    ) {
        Ok(v) => v,
        Err(e) => return http::err(400, &e),
    };
    let old = settings_service::get_or(&state, "auto_shutdown_timer_seconds", "180").await;
    if let Err(e) =
        settings_service::set(&state, "auto_shutdown_timer_seconds", &timer.to_string()).await
    {
        return http::err(500, &e.to_string());
    }
    audit(
        &kasir.user.username,
        "SETTINGS_AUTO_SHUTDOWN",
        &format!("Timer auto-shutdown diubah dari {old}s menjadi {timer}s"),
        Some(json!({"timer_sebelum": old, "timer_baru": timer})),
    );
    http::json(
        200,
        json!({"success": true, "message": "Timer berhasil diperbarui"}),
    )
}

pub async fn client_polling_interval(
    State(state): State<Arc<AppState>>,
    kasir: Kasir,
    body: Bytes,
) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let data = http::parse_json(&body);
    if data.is_null() {
        return http::err(400, "Request body diperlukan");
    }
    let raw = data.get("interval_seconds").or_else(|| data.get("value"));
    let old = settings_service::client_polling_interval(&state).await;
    let new = match settings_service::parse_polling_interval(raw) {
        Ok(v) => v,
        Err(e) => return http::err(400, &e),
    };
    if let Err(e) =
        settings_service::set(&state, "client_polling_interval_seconds", &new.to_string()).await
    {
        return http::err(500, &e.to_string());
    }
    audit(
        &kasir.user.username,
        "SETTINGS_CLIENT_POLLING_INTERVAL",
        &format!("Interval polling client diubah dari {old}s menjadi {new}s"),
        Some(json!({"interval_sebelum": old, "interval_baru": new})),
    );
    http::json(
        200,
        json!({
            "success": true,
            "message": format!("Interval polling client berhasil diset ke {new} detik"),
            "interval_seconds": new
        }),
    )
}

pub async fn get_one(
    State(state): State<Arc<AppState>>,
    kasir: Kasir,
    Path(key): Path<String>,
) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let default = match key.as_str() {
        "warnet_title" => Some("TMBilling"),
        "warnet_address" => Some("Jl. Merdeka No. 123, Kota"),
        "warnet_phone" => Some("0812-3456-7890"),
        "warnet_footer" => Some("Terima kasih, selamat bermain!"),
        _ => None,
    };
    let value = match settings_service::get(&state, &key)
        .await
        .or_else(|| default.map(str::to_string))
    {
        Some(v) => v,
        None => {
            return http::json(
                404,
                json!({"success": false, "error": format!("Setting '{key}' tidak ditemukan")}),
            )
        }
    };
    http::json(
        200,
        json!({"success": true, "key": key, "value": value, &key: value, "data": {"key": key.clone(), "value": value, &key: value}}),
    )
}

pub async fn put_one(
    State(state): State<Arc<AppState>>,
    kasir: Kasir,
    Path(key): Path<String>,
    body: Bytes,
) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let data = http::parse_json(&body);
    let Some(value) = data.get("value").cloned().filter(|v| !v.is_null()) else {
        return http::err(400, "Nilai 'value' wajib diisi");
    };
    if key == "client_api_key" {
        return http::err(
            400,
            "Client API Key harus diubah lewat endpoint /api/v1/kasir/settings/apikey",
        );
    }
    if !GENERIC_KEYS.contains(&key.as_str()) && !GENERIC_PREFIXES.iter().any(|p| key.starts_with(p))
    {
        return http::err(
            400,
            &format!("Setting '{key}' tidak boleh diubah lewat endpoint generik"),
        );
    }
    let text = match value {
        Value::String(s) => s,
        other => other.to_string(),
    };
    let text = if key == "warnet_announcement" {
        crate::utils::helpers::sanitize_html(&text)
    } else {
        text
    };
    if key == "payment_methods" {
        for method in text.split(',').map(str::trim).filter(|m| !m.is_empty()) {
            let low = method.to_lowercase();
            if low != "tunai" && (low.contains("tunai") || low.contains("cash")) {
                return http::err(
                    400,
                    &format!("Metode '{method}' tidak valid. Uang fisik/cash sudah dikelola sebagai 'Tunai'. Tambahkan hanya metode digital/non-tunai."),
                );
            }
        }
    }
    let old = settings_service::get_or(&state, &key, "-").await;
    if let Err(e) = settings_service::set(&state, &key, &text).await {
        return http::err(500, &e.to_string());
    }
    let action = if key == "payment_methods" {
        "PAYMENT_METHOD_CONFIG"
    } else {
        "SETTINGS_UPDATE"
    };
    audit(
        &kasir.user.username,
        action,
        &format!("Pengaturan '{key}' diperbarui"),
        Some(json!({"key": key, "old_value": old, "new_value": text})),
    );
    http::json(
        200,
        json!({"success": true, "message": format!("Setting '{key}' diperbarui")}),
    )
}

pub async fn apikey(State(state): State<Arc<AppState>>, kasir: Kasir, body: Bytes) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let data = http::parse_json(&body);
    let value = match data.get("value").and_then(|v| v.as_str()) {
        Some(v) => match validators::text(v, 4, 128, "Client API Key", true) {
            Ok(v) => v,
            Err(e) => return http::err(400, &e),
        },
        None => return http::err(400, "Client API Key harus 4 sampai 128 karakter"),
    };
    if let Err(e) = settings_service::set(&state, "client_api_key", &value).await {
        return http::err(500, &e.to_string());
    }
    if let Err(e) = crate::config::write_env_value(&state.cfg.root, "CLIENT_API_KEY", &value) {
        return http::err(500, &format!("Gagal menulis .env: {e}"));
    }
    audit(
        &kasir.user.username,
        "SETTINGS_APIKEY_CHANGE",
        "User memperbarui CLIENT_API_KEY secara dinamis",
        None,
    );
    http::json(
        200,
        json!({"success": true, "message": "API Key berhasil diperbarui di .env"}),
    )
}

pub async fn timezone(State(state): State<Arc<AppState>>, kasir: Kasir, body: Bytes) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    let data = http::parse_json(&body);
    let name = data
        .get("value")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if name.is_empty() {
        return http::err(400, "Timezone wajib diisi");
    }
    if name.parse::<chrono_tz::Tz>().is_err() {
        return http::err(400, &format!("Timezone '{name}' tidak valid"));
    }
    if let Err(e) = settings_service::set(&state, "timezone", &name).await {
        return http::err(500, &e.to_string());
    }
    audit(
        &kasir.user.username,
        "SETTINGS_TIMEZONE",
        &format!("Timezone diubah ke {name}"),
        None,
    );
    http::json(
        200,
        json!({"success": true, "message": format!("Timezone diubah ke {name}")}),
    )
}

/// `POST /api/v1/kasir/settings/ip-whitelist/regenerate-token` (dipakai juga untuk `?token=`).
pub async fn regenerate_token(State(state): State<Arc<AppState>>, kasir: Kasir) -> Response {
    if let Err(res) = admin_only(&kasir) {
        return res;
    }
    match ip_whitelist::regenerate_token(&state).await {
        Ok((token, version)) => {
            audit(
                &kasir.user.username,
                "IP_WHITELIST_TOKEN_REGEN",
                "Bypass token di-regenerate. Semua sesi remote di-invalidate.",
                None,
            );
            http::json(
                200,
                json!({"success": true, "token": token, "version": version}),
            )
        }
        Err(e) => http::err(500, &e.to_string()),
    }
}

pub async fn not_found() -> StatusCode {
    StatusCode::NOT_FOUND
}

pub fn _touch() -> impl IntoResponse {
    StatusCode::NO_CONTENT
}
