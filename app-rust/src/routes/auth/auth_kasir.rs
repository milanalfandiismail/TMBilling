//! Endpoint login/logout/check/admin-check kasir.

use crate::middleware::auth::{self, Kasir};
use crate::middleware::csrf;
use crate::services::auth::{auth_kasir_service, login_throttle};
use crate::services::settings::ip_whitelist;
use crate::state::AppState;
use crate::utils::http;
use axum::body::Bytes;
use axum::extract::{ConnectInfo, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::Response;
use serde_json::json;
use std::net::SocketAddr;
use std::sync::Arc;

fn str_of(data: &serde_json::Value, key: &str) -> String {
    data.get(key)
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string()
}

pub async fn login(
    State(state): State<Arc<AppState>>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let data = http::parse_json(&body);
    let username = str_of(&data, "username");
    let password = data
        .get("password")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let ip = auth_kasir_service::request_ip(&headers, peer);
    let agent = auth_kasir_service::user_agent(&headers);

    if login_throttle::check(&ip, &username) {
        return http::err(
            429,
            "Terlalu banyak percobaan login. Coba lagi dalam 5 menit.",
        );
    }

    let Some(pre_user) =
        auth_kasir_service::validate_credentials_only(&state.pool, &username, &password).await
    else {
        login_throttle::fail(&ip, &username);
        return http::err(401, "Username atau password salah");
    };

    if pre_user.role() != "admin"
        && ip_whitelist::is_enabled(&state).await
        && !ip_whitelist::is_allowed(&state, &ip).await
    {
        crate::utils::logger::audit(
            "system",
            "LOGIN_GAGAL",
            &format!("Username:{username} - IP {ip} tidak di whitelist"),
            None,
            &ip,
            &agent,
        );
        return http::json(
            403,
            json!({
                "error": "Akses Anda dibatasi.",
                "detail": format!("IP {ip} tidak diizinkan mengakses dashboard kasir. Hubungi admin untuk mendaftarkan IP Anda.")
            }),
        );
    }

    match auth_kasir_service::login(&state.pool, &username, &password, &ip, &agent).await {
        Ok(user) => {
            login_throttle::ok(&ip, &username);
            let session = auth::build_session(&user);
            let cookies = vec![
                auth::session_cookie(&state.cfg, &session),
                csrf::cookie_header(&csrf::new_token()),
            ];
            http::json_with_cookies(
                200,
                json!({
                    "success": true,
                    "user": user.to_json(),
                    "message": format!("Selamat datang, {}", user.nama())
                }),
                &cookies,
            )
        }
        Err(e) => http::json(e.status, json!({"error": e.message})),
    }
}

pub async fn logout(
    State(state): State<Arc<AppState>>,
    kasir: Kasir,
    headers: HeaderMap,
) -> Response {
    let ip = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    auth_kasir_service::logout(&kasir.user.username, &ip, "").await;
    auth::revoke_user(&state, kasir.user.id);
    let _ = &state;
    http::json_with_cookies(
        200,
        json!({"success": true, "message": "Logout berhasil"}),
        &[auth::clear_session_cookie()],
    )
}

pub async fn check(State(state): State<Arc<AppState>>, headers: HeaderMap) -> Response {
    let uid = http::cookie(&headers, auth::COOKIE)
        .and_then(|raw| auth::decode(&state.cfg, &raw))
        .map(|s| s.uid);
    match auth_kasir_service::check_session(&state.pool, uid).await {
        Some(user) => http::json(
            200,
            json!({
                "logged_in": true,
                "username": user.username,
                "role": user.role(),
                "nama_lengkap": user.nama_lengkap,
            }),
        ),
        None => http::json_with_cookies(
            200,
            json!({"logged_in": false}),
            &[auth::clear_session_cookie()],
        ),
    }
}

pub async fn admin_check(
    State(state): State<Arc<AppState>>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let data = http::parse_json(&body);
    let username = str_of(&data, "username");
    let password = data
        .get("password")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let ip = auth_kasir_service::request_ip(&headers, peer);
    let agent = auth_kasir_service::user_agent(&headers);

    if login_throttle::check(&ip, &username) {
        return http::err(
            429,
            "Terlalu banyak percobaan login. Coba lagi dalam 5 menit.",
        );
    }
    match auth_kasir_service::validate_admin(&state.pool, &username, &password, &ip, &agent).await {
        Ok(user) => {
            login_throttle::ok(&ip, &username);
            http::json(
                200,
                json!({
                    "success": true,
                    "user": {"id": user.id, "username": user.username, "role": user.role()},
                    "message": format!("Halo {}, akses diberikan.", user.nama())
                }),
            )
        }
        Err(e) => {
            login_throttle::fail(&ip, &username);
            http::json(e.status, json!({"success": false, "error": e.message}))
        }
    }
}

/// Halaman login: render template dan kirim cookie CSRF yang sama dengan meta.
pub async fn login_page(State(state): State<Arc<AppState>>, headers: HeaderMap) -> Response {
    use crate::routes::pages::{dasar, halaman_csrf};
    halaman_csrf("kasir/login.html", dasar(&state).await, &headers)
}

pub async fn not_found() -> StatusCode {
    StatusCode::NOT_FOUND
}
