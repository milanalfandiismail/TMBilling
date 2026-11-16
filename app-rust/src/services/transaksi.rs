//! Nota dan operator: penomoran `TM-YYYYMMDD-NNN-hex6` + pemetaan operator ke user.

use rand::Rng;
use sqlx::SqlitePool;

use crate::repositories::transaksi as repo;
use crate::utils::time::{now_db, now_local};

/// Nomor nota unik harian; suffix 3 digit mengikuti nomor tertinggi hari itu.
pub async fn generate_nota(pool: &SqlitePool, tz_name: &str) -> String {
    let date_str = now_local(tz_name).format("%Y%m%d").to_string();
    let next = repo::max_nota_seq(pool, &date_str).await.unwrap_or(0) + 1;
    let acak: u32 = rand::rng().random_range(0..0xFFFFFF);
    format!("TM-{date_str}-{:03}-{:06x}", next, acak)
}

/// ID user operator; `None` bila tidak dikenal (jangan menebak admin pertama).
pub async fn user_id(pool: &SqlitePool, operator: &str) -> Option<i64> {
    if operator.is_empty() || operator == "system" {
        return None;
    }
    let base = operator.split(" (").next().unwrap_or(operator).trim();
    sqlx::query_scalar("SELECT id FROM user WHERE username = ?")
        .bind(base)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
}

/// Timestamp DB siap tulis.
pub fn stamp() -> String {
    crate::models::sesi::stamp()
}

pub fn today_db() -> chrono::NaiveDateTime {
    now_db()
}
