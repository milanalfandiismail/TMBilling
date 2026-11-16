//! IP whitelist: entri CIDR, bypass token bersesi, dan seed default first-run.

use crate::services::settings::settings_service;
use crate::state::AppState;
use rand::Rng;
use serde_json::json;
use std::net::{IpAddr, Ipv4Addr, UdpSocket};

pub const ENABLED_KEY: &str = "ip_whitelist_enabled";
pub const WHITELIST_KEY: &str = "ip_whitelist";
pub const TOKEN_KEY: &str = "ip_whitelist_token";
pub const TOKEN_VERSION_KEY: &str = "ip_whitelist_token_version";
pub const PUBLIC_URL_KEY: &str = "app_public_url";
pub const SESSION_FLAG_KEY: &str = "ip_wh_authenticated";

fn ipv4_of(ip: &str) -> Option<Ipv4Addr> {
    match ip.parse::<IpAddr>() {
        Ok(IpAddr::V4(v4)) => Some(v4),
        Ok(IpAddr::V6(v6)) => v6.to_ipv4_mapped(),
        Err(_) => None,
    }
}

fn in_cidr(addr: Ipv4Addr, cidr: &str) -> bool {
    let (net, bits) = match cidr.split_once('/') {
        Some((net, bits)) => (net, bits.parse::<u32>().ok()),
        None => (cidr, Some(32)),
    };
    let (Some(bits), Ok(net)) = (bits, net.trim().parse::<Ipv4Addr>()) else {
        return false;
    };
    if bits > 32 {
        return false;
    }
    let mask = if bits == 0 {
        0
    } else {
        u32::MAX << (32 - bits)
    };
    (u32::from(addr) & mask) == (u32::from(net) & mask)
}

pub fn is_ip_whitelisted(entries: &[String], ip: &str) -> bool {
    match ipv4_of(ip) {
        Some(addr) => entries.iter().any(|e| in_cidr(addr, e.trim())),
        None => false,
    }
}

pub async fn is_enabled(st: &AppState) -> bool {
    settings_service::get_or(st, ENABLED_KEY, "true").await != "false"
}

pub async fn set_enabled(st: &AppState, enabled: bool) -> anyhow::Result<()> {
    settings_service::set(st, ENABLED_KEY, if enabled { "true" } else { "false" }).await
}

pub fn entries_from_raw(raw: &str) -> Vec<serde_json::Value> {
    serde_json::from_str::<Vec<serde_json::Value>>(raw).unwrap_or_default()
}

pub fn whitelisted_ips(entries: &[serde_json::Value]) -> Vec<String> {
    entries
        .iter()
        .filter_map(|e| e.get("ip").and_then(|v| v.as_str()).map(str::to_string))
        .collect()
}

pub async fn entries(st: &AppState) -> Vec<serde_json::Value> {
    entries_from_raw(&settings_service::get_or(st, WHITELIST_KEY, "[]").await)
}

pub async fn is_allowed(st: &AppState, ip: &str) -> bool {
    is_ip_whitelisted(&whitelisted_ips(&entries(st).await), ip)
}

pub fn validate_entry(ip: &str) -> Result<String, String> {
    let raw = ip.trim();
    if raw.is_empty() {
        return Err("Alamat IP tidak boleh kosong".into());
    }
    let (net, bits) = match raw.split_once('/') {
        Some((net, bits)) => (net, Some(bits)),
        None => (raw, None),
    };
    if net.parse::<Ipv4Addr>().is_err() {
        return Err("Format alamat IP tidak valid (contoh: 192.168.1.100)".into());
    }
    if let Some(bits) = bits {
        match bits.parse::<u32>() {
            Ok(b) if b <= 32 => {}
            _ => return Err("Prefix CIDR harus antara 0 dan 32".into()),
        }
    }
    Ok(raw.to_string())
}

pub async fn save_entries(st: &AppState, list: &[serde_json::Value]) -> anyhow::Result<()> {
    settings_service::set(st, WHITELIST_KEY, &serde_json::to_string(list)?).await
}

pub async fn add(st: &AppState, ip: &str, label: &str) -> Result<(), String> {
    let ip = validate_entry(ip)?;
    let mut list = entries(st).await;
    if list
        .iter()
        .any(|e| e.get("ip").and_then(|v| v.as_str()) == Some(ip.as_str()))
    {
        return Err("IP sudah ada di whitelist".into());
    }
    list.push(json!({
        "ip": ip,
        "label": label.trim(),
        "added_at": crate::utils::time::now_utc().to_rfc3339(),
    }));
    save_entries(st, &list).await.map_err(|e| e.to_string())
}

pub async fn remove(st: &AppState, ip: &str) -> Result<bool, String> {
    let mut list = entries(st).await;
    let before = list.len();
    list.retain(|e| e.get("ip").and_then(|v| v.as_str()) != Some(ip));
    if list.len() == before {
        return Ok(false);
    }
    save_entries(st, &list).await.map_err(|e| e.to_string())?;
    Ok(true)
}

pub async fn token(st: &AppState) -> String {
    settings_service::get_or(st, TOKEN_KEY, "").await
}

pub async fn token_version(st: &AppState) -> u32 {
    settings_service::get_or(st, TOKEN_VERSION_KEY, "1")
        .await
        .parse()
        .unwrap_or(1)
}

pub async fn token_masked(st: &AppState) -> String {
    let token = token(st).await;
    if token.len() > 8 {
        format!("{}...{}", &token[..4], &token[token.len() - 4..])
    } else {
        token
    }
}

pub async fn regenerate_token(st: &AppState) -> anyhow::Result<(String, u32)> {
    let new_token: String = rand::rng()
        .sample_iter(rand::distr::Alphanumeric)
        .take(43)
        .map(char::from)
        .collect();
    let version = token_version(st).await + 1;
    settings_service::set(st, TOKEN_KEY, &new_token).await?;
    settings_service::set(st, TOKEN_VERSION_KEY, &version.to_string()).await?;
    Ok((new_token, version))
}

pub fn is_session_token_valid(
    session_auth_flag: bool,
    session_version: u32,
    current_version: u32,
) -> bool {
    session_auth_flag && session_version == current_version
}

async fn lan_ip() -> String {
    let probe = || -> Option<String> {
        let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
        socket.connect("10.255.255.255:1").ok()?;
        let addr = socket.local_addr().ok()?;
        Some(addr.ip().to_string())
    };
    match probe() {
        Some(ip) if !ip.starts_with("127.") => ip,
        _ => "127.0.0.1".to_string(),
    }
}

/// Seed first-run: aktifkan whitelist dan daftarkan localhost + IP LAN server.
pub async fn seed_defaults(st: &AppState) -> anyhow::Result<()> {
    if settings_service::get(st, ENABLED_KEY).await.is_none() {
        settings_service::set(st, ENABLED_KEY, "true").await?;
    }
    if settings_service::get(st, WHITELIST_KEY).await.is_none() {
        let lan = lan_ip().await;
        let now = crate::utils::time::now_utc().to_rfc3339();
        let mut list = vec![json!({"ip": "127.0.0.1", "added_at": now, "label": "localhost"})];
        if lan != "127.0.0.1" {
            list.push(json!({"ip": lan, "added_at": now, "label": "server"}));
        }
        settings_service::set(st, WHITELIST_KEY, &serde_json::to_string(&list)?).await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cidr_dan_ip_tunggal_cocok() {
        let entries = vec!["192.168.1.10".to_string(), "10.0.0.0/8".to_string()];
        assert!(is_ip_whitelisted(&entries, "192.168.1.10"));
        assert!(is_ip_whitelisted(&entries, "10.9.9.9"));
        assert!(!is_ip_whitelisted(&entries, "192.168.1.11"));
        assert!(!is_ip_whitelisted(&entries, "bukan-ip"));
    }

    #[test]
    fn validasi_entri_menolak_ipv6_dan_prefix_salah() {
        assert!(validate_entry("192.168.1.5").is_ok());
        assert!(validate_entry("10.0.0.0/8").is_ok());
        assert!(validate_entry("10.0.0.0/40").is_err());
        assert!(validate_entry("::1").is_err());
        assert!(validate_entry("").is_err());
    }

    #[test]
    fn token_sesi_hanya_valid_bila_versi_sama() {
        assert!(is_session_token_valid(true, 2, 2));
        assert!(!is_session_token_valid(true, 1, 2));
        assert!(!is_session_token_valid(false, 2, 2));
    }
}
