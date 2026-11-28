//! Portal member publik: login/logout/status/profil (cookie `tm_member`).

use std::sync::Arc;

use axum::extract::State;
use axum::http::HeaderMap;
use axum::response::Response;
use base64::Engine;
use hmac::{Hmac, Mac};
use serde_json::{json, Value};
use sha2::Sha256;

use crate::models::user::{hash_password, verify_password};
use crate::state::AppState;
use crate::utils::http;
use crate::utils::time::format_db_str;
use crate::utils::validators;

pub fn member_tx_filter_clause(filter: &str) -> &'static str {
    match filter {
        "beli_tambah_waktu" => "jenis IN ('beli_paket_member', 'beli_paket_guest', 'tambah_waktu_sesi', 'tambah_waktu_guest')",
        "refund" => "(jenis IN ('refund_paket', 'blackout_refund') OR COALESCE(is_refunded, 0) = 1)",
        _ => "(jenis IN ('beli_paket_member', 'beli_paket_guest', 'tambah_waktu_sesi', 'tambah_waktu_guest', 'refund_paket', 'blackout_refund') OR COALESCE(is_refunded, 0) = 1)",
    }
}

pub fn member_tx_jenis_display(jenis: &str) -> &'static str {
    match jenis {
        "beli_paket_member" | "beli_paket_guest" | "tambah_waktu_sesi" | "tambah_waktu_guest" => "Beli Paket - Tambah Waktu",
        "refund_paket" | "blackout_refund" => "Refund",
        _ => "Lainnya",
    }
}

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
    let tag_bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(tag).ok()?;
    if mac.verify_slice(&tag_bytes).is_err() {
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
    let nama_lengkap = data
        .get("nama_lengkap")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    if let Some(n) = &nama_lengkap {
        if n.chars().count() > 100 {
            return http::err(400, "Nama lengkap maksimal 100 karakter");
        }
    }
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
    let current_password = data
        .get("current_password")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if password.is_some() {
        if current_password.is_empty() {
            return http::err(400, "Password saat ini wajib diisi untuk mengubah password");
        }
        let member = match crate::repositories::member::get_by_id(&st.pool, id).await {
            Ok(Some(m)) => m,
            _ => return http::err(404, "Member tidak ditemukan"),
        };
        if !verify_password(&member.password_hash, current_password) {
            return http::err(401, "Password saat ini salah");
        }
    }
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
        "UPDATE member SET nama_lengkap = COALESCE(?, nama_lengkap), email = COALESCE(?, email),
            no_hp = COALESCE(?, no_hp), password_hash = COALESCE(?, password_hash) WHERE id = ?",
    )
    .bind(nama_lengkap)
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

#[derive(serde::Deserialize)]
pub struct HistoryQuery {
    pub kind: Option<String>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub jenis: Option<String>,
    pub q: Option<String>,
}

pub async fn history(
    State(st): State<Arc<AppState>>,
    headers: HeaderMap,
    axum::extract::Query(q): axum::extract::Query<HistoryQuery>,
) -> Response {
    let Some(mid) = sesi(&st, &headers) else {
        return http::err(401, "Sesi member berakhir, silakan login ulang");
    };
    let kind = q.kind.as_deref().unwrap_or("tx");
    let per_page = q.per_page.unwrap_or(10).clamp(5, 25);
    let page_req = q.page.unwrap_or(1).max(1);
    let search = q.q.unwrap_or_default().trim().to_lowercase();
    let like_pat = format!("%{search}%");

    let tz_name = crate::services::settings::settings_service::active_timezone(&st).await;
    let tz_lbl = crate::utils::time::tz_label(&tz_name);

    if kind == "sesi" {
        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM sesi s LEFT JOIN pc p ON p.id = s.pc_id
             WHERE s.member_id = ? AND (? = '' OR LOWER(COALESCE(p.kode,'')) LIKE ?)",
        )
        .bind(mid)
        .bind(&search)
        .bind(&like_pat)
        .fetch_one(&st.pool)
        .await
        .unwrap_or(0);

        let pages = ((total + per_page - 1) / per_page).max(1);
        let page = page_req.min(pages);
        let rows: Vec<(Option<String>, String, Option<String>, String, i64)> = sqlx::query_as(
            "SELECT p.kode, s.mulai_pada, s.selesai_pada, s.status,
                    CAST(MAX(0, CAST((julianday(COALESCE(s.selesai_pada, datetime('now'))) - julianday(COALESCE(s.waktu_mulai_sesi, s.mulai_pada))) * 1440 AS INTEGER) - COALESCE(s.menit_pause_total,0)) AS INTEGER)
             FROM sesi s LEFT JOIN pc p ON p.id = s.pc_id
             WHERE s.member_id = ? AND (? = '' OR LOWER(COALESCE(p.kode,'')) LIKE ?)
             ORDER BY s.mulai_pada DESC LIMIT ? OFFSET ?",
        )
        .bind(mid)
        .bind(&search)
        .bind(&like_pat)
        .bind(per_page)
        .bind((page - 1) * per_page)
        .fetch_all(&st.pool)
        .await
        .unwrap_or_default();

        let items: Vec<Value> = rows
            .into_iter()
            .map(|(kode, mulai, selesai, status, menit)| {
                json!({
                    "pc_kode": kode.unwrap_or_else(|| "-".into()),
                    "mulai_pada": format_db_str(&mulai, &tz_name, "%d-%m-%Y %H:%M %Z"),
                    "mulai_pada_full": format_db_str(&mulai, &tz_name, "%d-%m-%Y %H:%M %Z"),
                    "selesai_pada": selesai,
                    "status": status,
                    "menit_terpakai": menit
                })
            })
            .collect();

        return http::json(
            200,
            json!({
                "success": true,
                "kind": "sesi",
                "items": items,
                "timezone_label": tz_lbl,
                "pagination": {
                    "page": page, "pages": pages, "total": total,
                    "has_prev": page > 1, "prev_num": page - 1,
                    "has_next": page < pages, "next_num": page + 1
                }
            }),
        );
    }

    let jenis_filter = q.jenis.unwrap_or_else(|| "all".into());
    let filter_clause = member_tx_filter_clause(&jenis_filter);
    let count_sql = format!(
        "SELECT COUNT(*) FROM transaksi
         WHERE member_id = ?
           AND {filter_clause}
           AND (? = '' OR LOWER(COALESCE(keterangan,'')) LIKE ? OR LOWER(COALESCE(no_nota,'')) LIKE ?)"
    );
    let total: i64 = sqlx::query_scalar(&count_sql)
        .bind(mid)
        .bind(&search)
        .bind(&like_pat)
        .bind(&like_pat)
        .fetch_one(&st.pool)
        .await
        .unwrap_or(0);

    let pages = ((total + per_page - 1) / per_page).max(1);
    let page = page_req.min(pages);
    let rows_sql = format!(
        "SELECT jenis, jumlah, keterangan, COALESCE(dibuat_pada,''), COALESCE(is_refunded,0), COALESCE(menit,0), no_nota
         FROM transaksi
         WHERE member_id = ?
           AND {filter_clause}
           AND (? = '' OR LOWER(COALESCE(keterangan,'')) LIKE ? OR LOWER(COALESCE(no_nota,'')) LIKE ?)
         ORDER BY dibuat_pada DESC, id DESC LIMIT ? OFFSET ?"
    );
    let rows: Vec<(String, i64, Option<String>, String, i64, i64, Option<String>)> = sqlx::query_as(&rows_sql)
        .bind(mid)
        .bind(&search)
        .bind(&like_pat)
        .bind(&like_pat)
        .bind(per_page)
        .bind((page - 1) * per_page)
        .fetch_all(&st.pool)
        .await
        .unwrap_or_default();

    let items: Vec<Value> = rows
        .into_iter()
        .map(|(jenis, jumlah, ket, dibuat, refund, menit, no_nota)| {
            json!({
                "jenis": jenis,
                "jenis_display": member_tx_jenis_display(&jenis),
                "jumlah": jumlah,
                "keterangan": ket,
                "dibuat_pada": format_db_str(&dibuat, &tz_name, "%d-%m-%Y %H:%M %Z"),
                "is_refunded": refund == 1,
                "menit": menit,
                "no_nota": no_nota
            })
        })
        .collect();

    http::json(
        200,
        json!({
            "success": true,
            "kind": "tx",
            "items": items,
            "timezone_label": tz_lbl,
            "pagination": {
                "page": page, "pages": pages, "total": total,
                "has_prev": page > 1, "prev_num": page - 1,
                "has_next": page < pages, "next_num": page + 1
            }
        }),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_waktu_sesi_dd_mm_yyyy_hh_mm() {
        let out = format_db_str("2026-11-25 10:30:45.123456", "Asia/Makassar", "%d-%m-%Y %H:%M %Z");
        assert_eq!(out, "25-11-2026 18:30 WITA");

        let out_wib = format_db_str("2026-11-25 10:30:45.123456", "Asia/Jakarta", "%d-%m-%Y %H:%M %Z");
        assert_eq!(out_wib, "25-11-2026 17:30 WIB");

        let out_wit = format_db_str("2026-11-25 10:30:45.123456", "Asia/Jayapura", "%d-%m-%Y %H:%M %Z");
        assert_eq!(out_wit, "25-11-2026 19:30 WIT");
    }

    #[test]
    fn label_transaksi_hanya_dua_kategori() {
        assert_eq!(member_tx_jenis_display("beli_paket_member"), "Beli Paket - Tambah Waktu");
        assert_eq!(member_tx_jenis_display("tambah_waktu_sesi"), "Beli Paket - Tambah Waktu");
        assert_eq!(member_tx_jenis_display("refund_paket"), "Refund");
        assert_eq!(member_tx_jenis_display("blackout_refund"), "Refund");
    }

    #[test]
    fn filter_sql_mengecualikan_aktivitas_non_transaksi() {
        let all_sql = member_tx_filter_clause("all");
        assert!(!all_sql.contains("tutup_sesi"));
        assert!(!all_sql.contains("pindah_pc"));
        assert!(member_tx_filter_clause("beli_tambah_waktu").contains("tambah_waktu_sesi"));
        assert!(member_tx_filter_clause("refund").contains("refund_paket"));
    }
}
