//! Query shift kasir.

use sqlx::SqlitePool;

use crate::models::shift::ShiftRecord;

const SELECT: &str = "SELECT s.id, s.kasir_id, u.username AS kasir_username, \
    u.nama_lengkap AS kasir_nama, s.waktu_mulai, s.waktu_selesai, \
    COALESCE(s.modal_awal, 0) AS modal_awal, COALESCE(s.total_billing, 0) AS total_billing, \
    COALESCE(s.total_kantin, 0) AS total_kantin, COALESCE(s.total_qris, 0) AS total_qris, \
    COALESCE(s.total_refund, 0) AS total_refund, s.uang_fisik, s.selisih, s.catatan, \
    s.detail_metode_json, s.status FROM shift_record s LEFT JOIN user u ON u.id = s.kasir_id";

pub async fn get_by_id(pool: &SqlitePool, id: i64) -> sqlx::Result<Option<ShiftRecord>> {
    sqlx::query_as::<_, ShiftRecord>(&format!("{SELECT} WHERE s.id = ?"))
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn get_active_any(pool: &SqlitePool) -> sqlx::Result<Option<ShiftRecord>> {
    sqlx::query_as::<_, ShiftRecord>(&format!("{SELECT} WHERE s.status = 'AKTIF'"))
        .fetch_optional(pool)
        .await
}

pub async fn get_active_by_kasir(
    pool: &SqlitePool,
    kasir_id: i64,
) -> sqlx::Result<Option<ShiftRecord>> {
    sqlx::query_as::<_, ShiftRecord>(&format!(
        "{SELECT} WHERE s.kasir_id = ? AND s.status = 'AKTIF'"
    ))
    .bind(kasir_id)
    .fetch_optional(pool)
    .await
}

pub async fn insert(
    pool: &SqlitePool,
    kasir_id: i64,
    modal_awal: i64,
    now: &str,
) -> sqlx::Result<i64> {
    sqlx::query(
        "INSERT INTO shift_record (kasir_id, waktu_mulai, modal_awal, total_billing, total_kantin, \
         total_qris, total_refund, status) VALUES (?, ?, ?, 0, 0, 0, 0, 'AKTIF')",
    )
    .bind(kasir_id)
    .bind(now)
    .bind(modal_awal)
    .execute(pool)
    .await
    .map(|r| r.last_insert_rowid())
}

/// Tutup shift: satu UPDATE berisi seluruh angka hasil ringkasan.
#[allow(clippy::too_many_arguments)]
pub async fn tutup(
    pool: &SqlitePool,
    id: i64,
    waktu_selesai: &str,
    total_billing: i64,
    total_kantin: i64,
    total_qris: i64,
    total_refund: i64,
    uang_fisik: Option<i64>,
    selisih: Option<i64>,
    catatan: &str,
    detail_metode_json: &str,
) -> sqlx::Result<()> {
    sqlx::query(
        "UPDATE shift_record SET waktu_selesai = ?, total_billing = ?, total_kantin = ?, \
         total_qris = ?, total_refund = ?, uang_fisik = ?, selisih = ?, catatan = ?, \
         detail_metode_json = ?, status = 'SELESAI' WHERE id = ?",
    )
    .bind(waktu_selesai)
    .bind(total_billing)
    .bind(total_kantin)
    .bind(total_qris)
    .bind(total_refund)
    .bind(uang_fisik)
    .bind(selisih)
    .bind(catatan)
    .bind(detail_metode_json)
    .bind(id)
    .execute(pool)
    .await
    .map(|_| ())
}

pub async fn history(
    pool: &SqlitePool,
    kasir_id: Option<i64>,
    mulai: Option<&str>,
    selesai: Option<&str>,
    limit: i64,
    offset: i64,
) -> sqlx::Result<(Vec<ShiftRecord>, i64)> {
    let mut qb = sqlx::QueryBuilder::new(format!("{SELECT} WHERE s.status = 'SELESAI'"));
    if let Some(id) = kasir_id {
        qb.push(" AND s.kasir_id = ").push_bind(id);
    }
    if let Some(m) = mulai {
        qb.push(" AND s.waktu_mulai >= ").push_bind(m.to_string());
    }
    if let Some(s) = selesai {
        qb.push(" AND s.waktu_selesai < ")
            .push_bind(selesai_plus_1(s));
    }
    qb.push(" ORDER BY s.id DESC LIMIT ").push_bind(limit);
    qb.push(" OFFSET ").push_bind(offset);
    let rows = qb.build_query_as::<ShiftRecord>().fetch_all(pool).await?;

    let mut cb =
        sqlx::QueryBuilder::new("SELECT COUNT(*) FROM shift_record WHERE status = 'SELESAI'");
    if let Some(id) = kasir_id {
        cb.push(" AND kasir_id = ").push_bind(id);
    }
    if let Some(m) = mulai {
        cb.push(" AND waktu_mulai >= ").push_bind(m.to_string());
    }
    if let Some(s) = selesai {
        cb.push(" AND waktu_selesai < ")
            .push_bind(selesai_plus_1(s));
    }
    let total: i64 = cb.build_query_scalar().fetch_one(pool).await?;
    Ok((rows, total))
}

/// Batas atas eksklusif satu hari (timestamp teks UTC naive).
fn selesai_plus_1(day_start: &str) -> String {
    use crate::utils::time::{db_str, parse_dt};
    match parse_dt(day_start) {
        Some(d) => db_str(d + chrono::Duration::days(1)),
        None => day_start.to_string(),
    }
}
