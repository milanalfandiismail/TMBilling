//! Logika login kasir/admin, sesi, dan verifikasi admin.

use crate::middleware::whitelist::client_ip;
use crate::models::user::User;
use crate::repositories::user as user_repo;
use crate::services::auth::AuthError;
use crate::utils::logger::audit;
use axum::http::HeaderMap;
use chrono::NaiveDateTime;
use sqlx::SqlitePool;
use std::net::SocketAddr;

fn format_shift_time(raw: &str) -> String {
    let trimmed = raw.trim();
    for fmt in [
        "%Y-%m-%d %H:%M:%S%.f",
        "%Y-%m-%dT%H:%M:%S%.f",
        "%Y-%m-%d %H:%M:%S",
    ] {
        if let Ok(dt) = NaiveDateTime::parse_from_str(trimmed, fmt) {
            return dt.format("%d/%m/%Y %H:%M").to_string();
        }
    }
    trimmed.to_string()
}

/// Kasir lain yang sedang memegang shift aktif (jika ada).
async fn active_shift_holder(pool: &SqlitePool) -> Option<(i64, String, String)> {
    sqlx::query_as::<_, (i64, Option<String>, String, Option<String>)>(
        "SELECT s.kasir_id, u.nama_lengkap, u.username, s.waktu_mulai \
         FROM shift_record s LEFT JOIN user u ON u.id = s.kasir_id \
         WHERE s.status = 'AKTIF' LIMIT 1",
    )
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .map(|(id, nama, username, waktu)| {
        (
            id,
            nama.filter(|n| !n.is_empty()).unwrap_or(username),
            format_shift_time(waktu.as_deref().unwrap_or("")),
        )
    })
}

pub async fn validate_credentials_only(
    pool: &SqlitePool,
    username: &str,
    password: &str,
) -> Option<User> {
    if username.is_empty() || password.is_empty() {
        return None;
    }
    let user = user_repo::get_by_username(pool, username)
        .await
        .ok()
        .flatten()?;
    if user.check_password(password).await {
        Some(user)
    } else {
        None
    }
}

pub async fn login(
    pool: &SqlitePool,
    username: &str,
    password: &str,
    ip: &str,
    agent: &str,
) -> Result<User, AuthError> {
    if username.is_empty() || password.is_empty() {
        return Err(AuthError::new(401, "Username dan password wajib diisi"));
    }
    let user = user_repo::get_by_username(pool, username)
        .await
        .ok()
        .flatten();
    let Some(user) = user.filter(|_| true) else {
        audit(
            username,
            "LOGIN_GAGAL",
            &format!("Username:{username} - Password salah / tidak ditemukan"),
            None,
            ip,
            agent,
        );
        return Err(AuthError::new(401, "Username atau password salah"));
    };
    if !user.check_password(password).await {
        audit(
            username,
            "LOGIN_GAGAL",
            &format!("Username:{username} - Password salah / tidak ditemukan"),
            None,
            ip,
            agent,
        );
        return Err(AuthError::new(401, "Username atau password salah"));
    }

    // Satu shift aktif system-wide: kasir lain ditolak, admin bebas.
    if user.role() == "kasir" {
        if let Some((kasir_id, nama, waktu)) = active_shift_holder(pool).await {
            if kasir_id != user.id {
                audit(
                    username,
                    "LOGIN_DITOLAK_SHIFT",
                    &format!(
                        "Kasir {username} ditolak masuk karena shift aktif dipegang oleh {nama}"
                    ),
                    None,
                    ip,
                    agent,
                );
                return Err(AuthError::new(
                    403,
                    format!(
                        "Akses Ditolak: Shift kasir saat ini sedang aktif oleh '{nama}' sejak {waktu}. \
                         Kasir lain tidak dapat masuk sampai shift tersebut ditutup."
                    ),
                ));
            }
        }
    }

    audit(
        username,
        "LOGIN",
        &format!(
            "Kasir:{username} ({}) login",
            user.nama_lengkap.clone().unwrap_or_default()
        ),
        None,
        ip,
        agent,
    );
    Ok(user)
}

pub async fn logout(username: &str, ip: &str, agent: &str) {
    audit(
        username,
        "LOGOUT",
        &format!("Kasir {username} logout"),
        None,
        ip,
        agent,
    );
}

pub async fn check_session(pool: &SqlitePool, user_id: Option<i64>) -> Option<User> {
    let id = user_id?;
    match user_repo::get_by_id(pool, id).await.ok().flatten() {
        Some(u) if u.active() => Some(u),
        _ => None,
    }
}

pub async fn validate_admin(
    pool: &SqlitePool,
    username: &str,
    password: &str,
    ip: &str,
    agent: &str,
) -> Result<User, AuthError> {
    if username.is_empty() || password.is_empty() {
        return Err(AuthError::new(401, "Kredensial wajib diisi"));
    }
    let user = user_repo::find_by_username(pool, username)
        .await
        .ok()
        .flatten();
    let Some(user) = user else {
        audit(
            username,
            "ADMIN_CHECK_FAILED",
            &format!("Username:{username} - Salah password / tidak ditemukan"),
            None,
            ip,
            agent,
        );
        return Err(AuthError::new(401, "Username atau password salah"));
    };
    if !user.check_password(password).await {
        audit(
            username,
            "ADMIN_CHECK_FAILED",
            &format!("Username:{username} - Salah password / tidak ditemukan"),
            None,
            ip,
            agent,
        );
        return Err(AuthError::new(401, "Username atau password salah"));
    }
    if user.role() != "admin" {
        audit(
            username,
            "ADMIN_CHECK_DENIED",
            &format!("User:{username} bukan admin"),
            None,
            ip,
            agent,
        );
        return Err(AuthError::new(403, "Akses ditolak. Perlu hak akses Admin."));
    }
    audit(
        username,
        "ADMIN_CHECK_SUCCESS",
        &format!("User:{username} berhasil verifikasi admin"),
        None,
        ip,
        agent,
    );
    Ok(user)
}

/// IP klien untuk throttle, memakai aturan header proxy yang sama dengan whitelist.
pub fn request_ip(headers: &HeaderMap, peer: SocketAddr) -> String {
    client_ip(headers, Some(peer))
}

pub fn user_agent(headers: &HeaderMap) -> String {
    headers
        .get(axum::http::header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string()
}
