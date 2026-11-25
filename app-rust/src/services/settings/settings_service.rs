//! Pengaturan sistem: baca dari cache RAM, tulis write-through DB + cache.

use crate::cache::settings::SettingsCache;
use crate::repositories::settings as settings_repo;
use crate::state::AppState;
use rand::Rng;
use std::collections::HashMap;

/// Default tampilan; diterapkan saat baca agar DB lama tanpa key tetap berfungsi.
pub const DEFAULTS: &[(&str, &str)] = &[
    ("warnet_title", "TMBilling"),
    ("warnet_announcement", ""),
    ("warnet_address", "Jl. Merdeka No. 123, Kota"),
    ("warnet_phone", "0812-3456-7890"),
    ("warnet_footer", "Terima kasih, selamat bermain!"),
    ("warnet_gmaps", ""),
    ("qris_image_url", "/static/uploads/qris/default_qris.png"),
    ("mikrotik_enabled", "0"),
    ("mikrotik_host", "192.168.1.1"),
    ("mikrotik_port", "8728"),
    ("mikrotik_username", "admin"),
    ("mikrotik_password", ""),
    ("mikrotik_hotspot_profile", "default"),
    ("screenshot_auto_enabled", "0"),
    ("screenshot_auto_value", "60"),
    ("screenshot_auto_unit", "detik"),
    ("payment_methods", "Tunai,QRIS,Transfer Bank"),
    ("client_polling_interval_seconds", "5"),
];

async fn read_through(st: &AppState, cache: &SettingsCache, key: &str) -> Option<String> {
    if let Some(v) = cache.get(key) {
        return Some(v);
    }
    if cache.is_missing(key) {
        return None;
    }
    if !cache.is_complete() {
        // Snapshot cache belum tentu lengkap: konfirmasi ke DB sekali saja.
        if let Some(v) = settings_repo::find(&st.pool, key).await {
            cache.set(key, &v);
            return Some(v);
        }
    }
    cache.mark_missing(key);
    None
}

pub async fn get(st: &AppState, key: &str) -> Option<String> {
    read_through(st, &st.settings, key).await
}

pub async fn get_or(st: &AppState, key: &str, default: &str) -> String {
    get(st, key).await.unwrap_or_else(|| default.to_string())
}

pub async fn get_all(st: &AppState) -> HashMap<String, String> {
    let mut data = st.settings.get_all();
    if !st.settings.has_snapshot() {
        data = settings_repo::get_all(&st.pool).await;
        st.settings.update_all(data.clone());
    }
    for (k, v) in DEFAULTS {
        if data.get(*k).map(|cur| cur.is_empty()).unwrap_or(true) {
            data.insert(k.to_string(), v.to_string());
        }
    }
    data
}

pub async fn set(st: &AppState, key: &str, value: &str) -> anyhow::Result<()> {
    settings_repo::set(&st.pool, key, value).await?;
    st.settings.set(key, value);
    Ok(())
}

pub async fn client_polling_interval(st: &AppState) -> i64 {
    match get(st, "client_polling_interval_seconds").await {
        None => {
            let _ = set(st, "client_polling_interval_seconds", "5").await;
            5
        }
        Some(raw) => match raw.parse::<i64>() {
            Ok(v) if [1, 5, 10].contains(&v) => v,
            _ => 5,
        },
    }
}

pub fn parse_polling_interval(raw: Option<&serde_json::Value>) -> Result<i64, String> {
    let raw = raw.ok_or("Interval polling client harus berupa angka (1, 5, atau 10 detik)")?;
    let value = match raw {
        serde_json::Value::Number(n) => n.as_i64(),
        serde_json::Value::String(s) => s.trim().parse::<i64>().ok(),
        _ => None,
    }
    .ok_or("Interval polling client harus berupa angka (1, 5, atau 10 detik)")?;
    if ![1, 5, 10].contains(&value) {
        return Err("Interval polling client hanya boleh 1, 5, atau 10 detik".into());
    }
    Ok(value)
}

/// Token acak: dibuat sekali lalu dipakai permanen (setara `secrets.token_urlsafe`).
pub async fn get_or_create_secret(st: &AppState, key: &str, len: usize) -> String {
    if let Some(existing) = get(st, key).await.filter(|v| !v.trim().is_empty()) {
        return existing;
    }
    let token: String = rand::rng()
        .sample_iter(rand::distr::Alphanumeric)
        .take(len)
        .map(char::from)
        .collect();
    let _ = set(st, key, &token).await;
    token
}

pub async fn get_or_create_vnc_password(st: &AppState) -> String {
    let current = get(st, "vnc_password")
        .await
        .unwrap_or_default()
        .trim()
        .to_string();
    if current.is_empty() || current == "tmbilling123" {
        return get_or_create_secret(st, "vnc_password", 12).await;
    }
    current
}

pub async fn get_or_create_emergency_token(st: &AppState) -> String {
    get_or_create_secret(st, "emergency_token", 43).await
}

pub async fn get_or_create_uninstall_token(st: &AppState) -> String {
    get_or_create_secret(st, "uninstall_token", 43).await
}

/// Nilai aktif `CLIENT_API_KEY`: setting menang atas `.env`, keduanya dicerminkan.
pub async fn client_api_key(st: &AppState) -> String {
    match get(st, "client_api_key")
        .await
        .filter(|v| !v.trim().is_empty())
    {
        Some(v) => v,
        None => st.cfg.client_api_key.clone(),
    }
}

/// Timezone aktif: setting DB (`timezone`) jika valid, fallback ke `.env` (`st.cfg.timezone`).
pub async fn active_timezone(st: &AppState) -> String {
    if let Some(raw) = get(st, "timezone").await {
        let trimmed = raw.trim();
        if !trimmed.is_empty() && trimmed.parse::<chrono_tz::Tz>().is_ok() {
            return trimmed.to_string();
        }
    }
    st.cfg.timezone.clone()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn interval_polling_hanya_preset() {
        assert_eq!(parse_polling_interval(Some(&serde_json::json!(5))), Ok(5));
        assert_eq!(
            parse_polling_interval(Some(&serde_json::json!("10"))),
            Ok(10)
        );
        assert!(parse_polling_interval(Some(&serde_json::json!(7))).is_err());
        assert!(parse_polling_interval(None).is_err());
    }
}
