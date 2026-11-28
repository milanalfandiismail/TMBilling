//! Sesi kasir/admin: cookie bertanda tangan HMAC + ekstraktor `Kasir`.

use crate::config::Config;
use crate::models::user::User;
use crate::repositories::user as user_repo;
use crate::state::AppState;
use crate::utils::http;
use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use axum::http::StatusCode;
use axum::response::Response;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::sync::Arc;

pub const COOKIE: &str = "tm_session";
pub const SESSION_TTL_SECONDS: i64 = 86_400;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionData {
    pub uid: i64,
    pub uname: String,
    pub role: String,
    pub nama: Option<String>,
    pub exp: i64,
    /// Bypass IP whitelist lewat `?token=` (setara `ip_wh_authenticated`).
    #[serde(default)]
    pub ipwh: bool,
    #[serde(default)]
    pub ipwhv: u32,
}

fn mac(cfg: &Config, payload: &str) -> String {
    let mut h =
        <Hmac<Sha256> as Mac>::new_from_slice(cfg.secret_key.as_bytes()).expect("kunci HMAC");
    h.update(payload.as_bytes());
    hex::encode(h.finalize().into_bytes())
}

pub fn encode(cfg: &Config, data: &SessionData) -> String {
    let payload = URL_SAFE_NO_PAD.encode(serde_json::to_vec(data).unwrap_or_default());
    let sig = mac(cfg, &payload);
    format!("{payload}.{sig}")
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

pub fn decode(cfg: &Config, raw: &str) -> Option<SessionData> {
    let (payload, sig) = raw.split_once('.')?;
    let expected = mac(cfg, payload);
    if !constant_time_eq(expected.as_bytes(), sig.as_bytes()) {
        return None;
    }
    let bytes = URL_SAFE_NO_PAD.decode(payload).ok()?;
    let data: SessionData = serde_json::from_slice(&bytes).ok()?;
    if data.exp < chrono::Utc::now().timestamp() {
        return None;
    }
    Some(data)
}

pub fn is_revoked(state: &AppState, data: &SessionData) -> bool {
    let issued_at = data.exp - SESSION_TTL_SECONDS;
    state
        .revoked_before
        .lock()
        .ok()
        .and_then(|m| m.get(&data.uid).copied())
        .is_some_and(|cutoff| issued_at <= cutoff)
}

pub fn revoke_user(state: &AppState, uid: i64) {
    if let Ok(mut m) = state.revoked_before.lock() {
        m.insert(uid, chrono::Utc::now().timestamp());
    }
}

pub fn session_cookie(cfg: &Config, data: &SessionData) -> String {
    format!(
        "{COOKIE}={}; Path=/; HttpOnly; SameSite=Lax; Max-Age={SESSION_TTL_SECONDS}",
        encode(cfg, data)
    )
}

/// Menghapus seluruh isi sesi (setara `session.clear()` Flask).
pub fn clear_session_cookie() -> String {
    format!("{COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0")
}

pub fn extract_session(cfg: &Config, headers: &axum::http::HeaderMap) -> Option<SessionData> {
    let raw = http::cookie(headers, COOKIE)?;
    decode(cfg, &raw)
}

pub fn build_session(user: &User) -> SessionData {
    SessionData {
        uid: user.id,
        uname: user.username.clone(),
        role: user.role().to_string(),
        nama: user.nama_lengkap.clone(),
        exp: chrono::Utc::now().timestamp() + SESSION_TTL_SECONDS,
        ipwh: false,
        ipwhv: 0,
    }
}

pub struct Kasir {
    pub user: User,
    pub session: SessionData,
}

impl Kasir {
    pub fn is_admin(&self) -> bool {
        self.user.role() == "admin"
    }
}

impl FromRequestParts<Arc<AppState>> for Kasir {
    type Rejection = Response;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &Arc<AppState>,
    ) -> Result<Self, Self::Rejection> {
        let raw = http::cookie(&parts.headers, COOKIE)
            .ok_or_else(|| http::err(401, "Silakan login terlebih dahulu"))?;
        let session = decode(&state.cfg, &raw)
            .ok_or_else(|| http::err(401, "Silakan login terlebih dahulu"))?;
        if is_revoked(state, &session) {
            return Err(http::err(401, "Sesi telah kedaluwarsa, silakan login kembali"));
        }
        let user = if let Some(cached) = parts.extensions.get::<User>().cloned() {
            cached
        } else {
            user_repo::get_by_id(&state.pool, session.uid)
                .await
                .ok()
                .flatten()
                .filter(|u| u.active())
                .ok_or_else(|| http::err(401, "Sesi tidak valid, silakan login kembali"))?
        };
        let mut session = session;
        session.role = user.role().to_string();
        Ok(Self { user, session })
    }
}

/// Guard `@admin_required`.
pub fn admin_only(kasir: &Kasir) -> Result<(), Response> {
    if kasir.user.role() == "admin" {
        Ok(())
    } else {
        Err(http::json(
            StatusCode::FORBIDDEN.as_u16(),
            serde_json::json!({"error": "Akses Ditolak. Hanya Admin yang diizinkan."}),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn cfg() -> Config {
        let mut root = std::env::temp_dir();
        root.push(format!("tm_auth_{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        let mut c = Config::load(PathBuf::from(&root)).unwrap();
        c.secret_key = "kunci-uji".into();
        c
    }

    #[test]
    fn cookie_bertanda_tangan_bolak_balik() {
        let c = cfg();
        let data = SessionData {
            uid: 7,
            uname: "admin".into(),
            role: "admin".into(),
            nama: None,
            exp: chrono::Utc::now().timestamp() + 60,
            ipwh: false,
            ipwhv: 0,
        };
        let raw = encode(&c, &data);
        assert_eq!(decode(&c, &raw).unwrap().uid, 7);
        let mut c2 = c.clone();
        c2.secret_key = "lain".into();
        assert!(decode(&c2, &raw).is_none());
        assert!(decode(&c, &format!("{raw}x")).is_none());
    }

    #[test]
    fn sesi_kedaluwarsa_ditolak() {
        let c = cfg();
        let data = SessionData {
            uid: 1,
            uname: "a".into(),
            role: "kasir".into(),
            nama: None,
            exp: 1,
            ipwh: false,
            ipwhv: 0,
        };
        assert!(decode(&c, &encode(&c, &data)).is_none());
    }
}

/// Gate shift: admin bebas, kasir wajib punya shift AKTIF.
pub async fn shift_required(st: &AppState, kasir: &Kasir) -> Result<(), axum::response::Response> {
    if kasir.user.role() == "admin" {
        return Ok(());
    }
    let aktif: Option<String> = sqlx::query_scalar(
        "SELECT status FROM shift_record WHERE kasir_id = ? AND status = 'AKTIF'",
    )
    .bind(kasir.user.id)
    .fetch_optional(&st.pool)
    .await
    .map_err(|e| crate::utils::http::err(500, e.to_string()))?;
    if aktif.is_none() {
        return Err(crate::utils::http::err(
            400,
            "Harap buka shift terlebih dahulu sebelum melayani transaksi.",
        ));
    }
    Ok(())
}
