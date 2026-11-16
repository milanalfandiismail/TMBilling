//! Guard IP whitelist untuk `/kasir/` dan `/api/v1/kasir/`.
//!
//! Urutan sama seperti versi Python: token bypass `?token=` → pengecualian auth →
//! whitelist mati → admin/sesi token → cek IP → blokir. `CF-Connecting-IP` hanya
//! dipercaya bila peer TCP adalah loopback.

use crate::middleware::auth::{self, SessionData, SESSION_TTL_SECONDS};
use crate::repositories::user as user_repo;
use crate::services::settings::ip_whitelist;
use crate::state::AppState;
use axum::body::Body;
use axum::extract::{ConnectInfo, Request, State};
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use serde_json::json;
use std::net::SocketAddr;
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
        if let Some(v) = headers
            .get("cf-connecting-ip")
            .and_then(|v| v.to_str().ok())
        {
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
    peer_ip
        .map(|ip| ip.to_string())
        .unwrap_or_else(|| "0.0.0.0".into())
}

fn query_token(query: Option<&str>) -> Option<String> {
    query?.split('&').find_map(|pair| {
        let (k, v) = pair.split_once('=')?;
        (k == "token" && !v.is_empty()).then(|| v.to_string())
    })
}

fn same_token(a: &str, b: &str) -> bool {
    if a.len() != b.len() || a.is_empty() {
        return false;
    }
    a.bytes()
        .zip(b.bytes())
        .fold(0u8, |acc, (x, y)| acc | (x ^ y))
        == 0
}

fn wants_json(path: &str, headers: &HeaderMap) -> bool {
    path.starts_with("/api/")
        || headers
            .get(header::ACCEPT)
            .and_then(|v| v.to_str().ok())
            .is_some_and(|v| v.contains("json"))
}

fn redirect(to: &str, cookies: &[String]) -> Response {
    let mut res = (StatusCode::FOUND, Body::empty()).into_response();
    if let Ok(value) = HeaderValue::from_str(to) {
        res.headers_mut().insert(header::LOCATION, value);
    }
    for cookie in cookies {
        if let Ok(value) = cookie.parse() {
            res.headers_mut().append(header::SET_COOKIE, value);
        }
    }
    res
}

fn session_of(state: &AppState, headers: &HeaderMap) -> Option<SessionData> {
    crate::utils::http::cookie(headers, auth::COOKIE).and_then(|raw| auth::decode(&state.cfg, &raw))
}

pub async fn guard(State(state): State<Arc<AppState>>, req: Request, next: Next) -> Response {
    let path = req.uri().path().to_string();
    if !in_scope(&path) || exempt(&path) {
        return next.run(req).await;
    }

    let headers = req.headers().clone();
    let peer = req
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|c| c.0);
    let ip = client_ip(&headers, peer);

    if ip_whitelist::is_enabled(&state).await {
        let current = ip_whitelist::token(&state).await;
        if let Some(url_token) = query_token(req.uri().query()) {
            if same_token(&url_token, &current) {
                let session = SessionData {
                    uid: 0,
                    uname: String::new(),
                    role: String::new(),
                    nama: None,
                    exp: chrono::Utc::now().timestamp() + SESSION_TTL_SECONDS,
                    ipwh: true,
                    ipwhv: ip_whitelist::token_version(&state).await,
                };
                return redirect(&path, &[auth::session_cookie(&state.cfg, &session)]);
            }
        }
    }

    if !ip_whitelist::is_enabled(&state).await {
        return next.run(req).await;
    }

    let session = session_of(&state, &headers);
    if let Some(s) = &session {
        if s.role == "admin" {
            if let Ok(Some(user)) = user_repo::get_by_id(&state.pool, s.uid).await {
                if user.active() && user.role() == "admin" {
                    return next.run(req).await;
                }
            }
        }
        if ip_whitelist::is_session_token_valid(
            s.ipwh,
            s.ipwhv,
            ip_whitelist::token_version(&state).await,
        ) {
            return next.run(req).await;
        }
    }

    if ip_whitelist::is_allowed(&state, &ip).await {
        return next.run(req).await;
    }

    let logged_in = session.as_ref().is_some_and(|s| s.uid > 0);
    let mut cookies = Vec::new();
    if logged_in {
        let username = session
            .as_ref()
            .map(|s| s.uname.clone())
            .unwrap_or_else(|| "anonymous".into());
        let role = session.as_ref().map(|s| s.role.clone()).unwrap_or_default();
        crate::utils::logger::audit(
            &username,
            "IP_WHITELIST_SESSION_DESTROY",
            &format!("Session user {username} ({role}) dari IP {ip} dihancurkan karena IP dihapus dari whitelist"),
            None,
            &ip,
            "",
        );
        cookies.push(auth::clear_session_cookie());
    }
    crate::utils::logger::audit(
        "anonymous",
        "IP_WHITELIST_BLOCK",
        &format!(
            "IP {ip} diblokir mengakses {path} (method: {})",
            req.method()
        ),
        None,
        &ip,
        "",
    );

    if wants_json(&path, &headers) {
        let mut res = (
            StatusCode::FORBIDDEN,
            axum::Json(json!({"error": "forbidden", "ip": ip})),
        )
            .into_response();
        for cookie in cookies {
            if let Ok(value) = cookie.parse() {
                res.headers_mut().append(header::SET_COOKIE, value);
            }
        }
        res
    } else {
        redirect("/kasir/login", &cookies)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn header_proxy_hanya_dari_loopback() {
        let mut headers = HeaderMap::new();
        headers.insert("cf-connecting-ip", "1.2.3.4".parse().unwrap());
        let loopback = Some(SocketAddr::from(([127, 0, 0, 1], 5000)));
        let lan = Some(SocketAddr::from(([192, 168, 1, 5], 5000)));
        assert_eq!(client_ip(&headers, loopback), "1.2.3.4");
        assert_eq!(client_ip(&headers, lan), "192.168.1.5");
    }

    #[test]
    fn token_query_dibaca_dan_dibandingkan_konstan() {
        assert_eq!(
            query_token(Some("a=1&token=rahasia")),
            Some("rahasia".into())
        );
        assert_eq!(query_token(Some("token=")), None);
        assert!(same_token("rahasia", "rahasia"));
        assert!(!same_token("rahasia", "rahasib"));
        assert!(!same_token("", ""));
    }
}
