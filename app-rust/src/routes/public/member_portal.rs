//! Portal member publik: login/logout/status/profil (cookie `tm_member`).

use std::sync::Arc;

use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::Response;
use base64::Engine;
use hmac::{Hmac, Mac};
use serde_json::json;
use sha2::Sha256;

use crate::models::user::{hash_password, verify_password};
use crate::state::AppState;
use crate::utils::http;
use crate::utils::validators;

type HmacSha256 = Hmac<Sha256>;

fn token(st: &AppState, member_id: i64) -> String {
    let isi = format!("member:{member_id}");
    let mut mac = HmacSha256::new_from_slice(st.cfg.secret_key.as_bytes()).expect("hmac");
    mac.update(isi.as_bytes());
    let tag = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes());
    let badan = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(isi.as_bytes());
    format!("{badan}.{tag}")
}

fn baca(st: &AppState, nilai: &str) -> Option<i64> {
    let (badan, tag) = nilai.split_once('.')?;
    let isi = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(badan)
        .ok()?;
    let isi = String::from_utf8(isi).ok()?;
    let mut mac = HmacSha256::new_from_slice(st.cfg.secret_key.as_bytes()).ok()?;
    mac.update(isi.as_bytes());
    let harap =
        base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes());
    if harap != tag {
        return None;
    }
    isi.strip_prefix("member:")?.parse().ok()
}

pub(crate) fn sesi(st: &AppState, headers: &HeaderMap) -> Option<i64> {
    http::cookie(headers, "tm_member").and_then(|c| baca(st, &c))
}

fn ip_of(headers: &HeaderMap) -> String {
    headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(',').next())
        .map(|v| v.trim().to_string())
        .unwrap_or_else(|| "0.0.0.0".to_string())
}

pub async fn login(
    State(st): State<Arc<AppState>>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> Response {
    let data = http::parse_json(&body);
    let username = data
        .get("username")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_lowercase();
    let password = data.get("password").and_then(|v| v.as_str()).unwrap_or("");
    let ip = ip_of(&headers);
    if crate::services::auth::login_throttle::check(&ip, &username) {
        return http::err(
            429,
            "Terlalu banyak percobaan login. Coba lagi dalam 5 menit.",
        );
    }
    let member = match crate::repositories::member::find_by_username(&st.pool, &username).await {
        Ok(Some(m)) => m,
        _ => {
            crate::services::auth::login_throttle::fail(&ip, &username);
            return http::err(401, "Username atau password salah");
        }
    };
    if !member.aktif {
        return http::err(403, "Akun member Anda dinonaktifkan oleh kasir");
    }
    if !verify_password(&member.password_hash, password) {
        crate::services::auth::login_throttle::fail(&ip, &username);
        return http::err(401, "Username atau password salah");
    }
    if let (Some(raw), Some(now)) = (
        member.kadaluarsa_pada.as_deref().and_then(crate::utils::time::parse_dt),
        Some(crate::utils::time::now_db()),
    ) {
        if now > raw {
            return http::err(403, "Masa aktif member sudah kadaluarsa");
        }
    }
    crate::services::auth::login_throttle::ok(&ip, &username);
    let nilai = token(&st, member.id);
    http::json_with_cookies(
        200,
        json!({"success": true, "message": format!("Selamat datang, {}", member.username), "redirect": "/member/dashboard"}),
        &[format!(
            "tm_member={nilai}; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax"
        )],
    )
}

pub async fn logout() -> Response {
    http::json_with_cookies(
        200,
        json!({"success": true, "message": "Logout berhasil", "redirect": "/member/login"}),
        &["tm_member=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax".to_string()],
    )
}

pub async fn status(State(st): State<Arc<AppState>>, headers: HeaderMap) -> Response {
    let Some(id) = sesi(&st, &headers) else {
        return http::json(200, json!({"logged_in": false}));
    };
    match crate::repositories::member::get_by_id(&st.pool, id).await {
        Ok(Some(m)) => http::json(
            200,
            json!({"logged_in": true, "username": m.username, "nama_lengkap": m.nama_lengkap}),
        ),
        _ => http::json(200, json!({"logged_in": false})),
    }
}

pub async fn profile_update(
    State(st): State<Arc<AppState>>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> Response {
    let Some(id) = sesi(&st, &headers) else {
        return http::err(401, "Silakan login terlebih dahulu");
    };
    let data = http::parse_json(&body);
    let email = data
        .get("email")
        .map(|v| v.as_str().unwrap_or("").to_string());
    let no_hp = data
        .get("no_hp")
        .map(|v| v.as_str().unwrap_or("").to_string());
    let password = data
        .get("password")
        .and_then(|v| v.as_str())
        .filter(|p| !p.is_empty());
    if let Some(e) = &email {
        if let Err(pesan) = validators::email(e) {
            return http::err(400, pesan);
        }
    }
    if let Some(hp) = &no_hp {
        if let Err(pesan) = validators::phone(hp) {
            return http::err(400, pesan);
        }
    }
    let hash = match password {
        Some(p) => match validators::password(p, 4, 16) {
            Ok(_) => Some(hash_password(p)),
            Err(pesan) => return http::err(400, pesan),
        },
        None => None,
    };
    let hasil = sqlx::query(
        "UPDATE member SET email = COALESCE(?, email), no_hp = COALESCE(?, no_hp),
            password_hash = COALESCE(?, password_hash) WHERE id = ?",
    )
    .bind(email)
    .bind(no_hp)
    .bind(hash)
    .bind(id)
    .execute(&st.pool)
    .await;
    match hasil {
        Ok(_) => http::json(
            200,
            json!({"success": true, "message": "Profil berhasil diperbarui"}),
        ),
        Err(e) => http::json(500, json!({"success": false, "error": e.to_string()})),
    }
}
