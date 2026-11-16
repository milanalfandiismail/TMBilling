//! Guard IP whitelist untuk `/kasir/` dan `/api/v1/kasir/`.
//!
//! Sama seperti versi Python, kecuali token bypass berbasis sesi yang menyusul
//! di Task 4. `CF-Connecting-IP` hanya dipercaya bila peer TCP adalah loopback.

use crate::repositories::settings as settings_repo;
use crate::state::AppState;
use axum::body::Body;
use axum::extract::{ConnectInfo, Request, State};
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use serde_json::json;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::Arc;

const SCOPED_PREFIXES: [&str; 2] = ["/kasir/", "/api/v1/kasir/"];

fn in_scope(path: &str) -> bool {
    SCOPED_PREFIXES.iter().any(|p| path.starts_with(p))
}

fn exempt(path: &str) -> bool {
    path == "/kasir/login"
        || path.starts_with("/api/v1/kasir/auth/login")
        || path.starts_with("/api/v1/kasir/auth/check")
        || path.starts_with("/api/v1/kasir/auth/logout")
        || path == "/api/v1/kasir/settings/uninstall-token/client"
}

/// IP client dari peer TCP; header proxy hanya dipakai bila peer loopback.
pub fn client_ip(headers: &HeaderMap, peer: Option<SocketAddr>) -> String {
    let peer_ip = peer.map(|p| p.ip());
    if matches!(peer_ip, Some(ip) if ip.is_loopback()) {
        if let Some(v) = headers.get("cf-connecting-ip").and_then(|v| v.to_str().ok()) {
            let v = v.trim();
            if !v.is_empty() {
                return v.to_string();
            }
        }
        if let Some(v) = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok()) {
            if let Some(first) = v.split(',').next() {
                let first = first.trim();
                if !first.is_empty() {
                    return first.to_string();
                }
            }
        }
    }
    peer_ip.map(|ip| ip.to_string()).unwrap_or_else(|| "0.0.0.0".into())
}

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
    let (Some(bits), Ok(net)) = (bits, net.parse::<Ipv4Addr>()) else {
        return false;
    };
    if bits > 32 {
        return false;
    }
    let mask = if bits == 0 { 0 } else { u32::MAX << (32 - bits) };
    (u32::from(addr) & mask) == (u32::from(net) & mask)
}

pub fn is_ip_whitelisted(entries: &[String], ip: &str) -> bool {
    match ipv4_of(ip) {
        Some(addr) => entries.iter().any(|e| in_cidr(addr, e.trim())),
        None => false,
    }
}

async fn whitelist_entries(state: &AppState) -> Vec<String> {
    let raw = settings_repo::get(&state.pool, "ip_whitelist", "[]").await;
    let parsed: Vec<serde_json::Value> = serde_json::from_str(&raw).unwrap_or_default();
    parsed
        .iter()
        .filter_map(|e| e.get("ip").and_then(|v| v.as_str()).map(|s| s.to_string()))
        .collect()
}

pub async fn guard(State(state): State<Arc<AppState>>, req: Request, next: Next) -> Response {
    let path = req.uri().path().to_string();
    if !in_scope(&path) || exempt(&path) {
        return next.run(req).await;
    }
    let enabled = settings_repo::get(&state.pool, "ip_whitelist_enabled", "true").await == "true";
    if !enabled {
        return next.run(req).await;
    }

    let peer = req.extensions().get::<ConnectInfo<SocketAddr>>().map(|c| c.0);
    let ip = client_ip(req.headers(), peer);
    let entries = whitelist_entries(&state).await;
    if is_ip_whitelisted(&entries, &ip) {
        return next.run(req).await;
    }

    crate::utils::logger::audit(
        "anonymous",
        "IP_WHITELIST_BLOCK",
        &format!("IP {ip} diblokir mengakses {path}"),
        None,
        &ip,
        "",
    );

    if path.starts_with("/api/") {
        (StatusCode::FORBIDDEN, axum::Json(json!({"error": "forbidden", "ip": ip}))).into_response()
    } else {
        let mut res = (StatusCode::FOUND, Body::empty()).into_response();
        res.headers_mut()
            .insert(header::LOCATION, HeaderValue::from_static("/kasir/login"));
        res
    }
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
    fn header_proxy_hanya_dari_loopback() {
        let mut headers = HeaderMap::new();
        headers.insert("cf-connecting-ip", "1.2.3.4".parse().unwrap());
        let loopback = Some(SocketAddr::from(([127, 0, 0, 1], 5000)));
        let lan = Some(SocketAddr::from(([192, 168, 1, 5], 5000)));
        assert_eq!(client_ip(&headers, loopback), "1.2.3.4");
        assert_eq!(client_ip(&headers, lan), "192.168.1.5");
    }
}
