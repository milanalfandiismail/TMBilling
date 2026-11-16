//! Proteksi CSRF double-submit: cookie `csrf_token` harus sama dengan header
//! `X-CSRFToken` pada setiap request yang mengubah data.
//!
//! Klien agent memakai Bearer API key (tanpa cookie), jadi dilewati.

use crate::state::AppState;
use axum::extract::{Request, State};
use axum::http::{header, HeaderMap, Method};
use axum::middleware::Next;
use axum::response::Response;
use rand::Rng;
use std::sync::Arc;

pub const COOKIE: &str = "csrf_token";
pub const HEADER: &str = "x-csrftoken";

pub fn new_token() -> String {
    let mut rng = rand::rng();
    (0..32)
        .map(|_| format!("{:x}", rng.random_range(0..16)))
        .collect()
}

pub fn cookie_header(token: &str) -> String {
    format!("{COOKIE}={token}; Path=/; SameSite=Lax")
}

/// Cookie CSRF baru bila belum ada di request (dipakai halaman login).
pub fn ensure_cookie(headers: &HeaderMap) -> Option<String> {
    crate::utils::http::cookie(headers, COOKIE)
        .is_none()
        .then(|| cookie_header(&new_token()))
}

fn same(a: &str, b: &str) -> bool {
    a.len() == b.len()
        && a.bytes()
            .zip(b.bytes())
            .fold(0u8, |acc, (x, y)| acc | (x ^ y))
            == 0
}

pub async fn guard(State(_state): State<Arc<AppState>>, req: Request, next: Next) -> Response {
    let method = req.method().clone();
    if matches!(method, Method::GET | Method::HEAD | Method::OPTIONS) {
        return next.run(req).await;
    }
    if req.headers().contains_key(header::AUTHORIZATION) {
        return next.run(req).await;
    }
    let cookie = crate::utils::http::cookie(req.headers(), COOKIE).unwrap_or_default();
    let sent = req
        .headers()
        .get(HEADER)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if cookie.is_empty() || !same(&cookie, sent) {
        return crate::utils::http::err(400, "CSRF token tidak valid atau hilang");
    }
    next.run(req).await
}
