//! Query sesi bermain: baris aktif, rantai pindah PC, dan daftar audit blackout.

use sqlx::SqlitePool;

use crate::models::sesi::Sesi;

const SELECT: &str = "SELECT s.id, s.tipe, s.member_id, s.user_id, s.pc_id, s.paket_id, \
    s.sesi_asal_id, s.nama_guest, s.token_sesi, s.mulai_pada, s.selesai_pada, \
    s.durasi_beli_menit, s.total_bayar, s.status, s.is_admin, s.waktu_mulai_sesi, \
    s.waktu_tersimpan_awal, s.last_sync, s.menit_pause_total, s.sisa_menit_saat_mati, \
    s.is_blackout_suspect, s.is_blackout_resolved, s.waktu_resolved, s.is_afk, s.afk_pin, \
    s.afk_sejak, pc.kode AS pc_kode, pc.grup_id AS pc_grup_id, g.nama AS pc_grup_nama, \
    m.username AS member_username, COALESCE(m.nama_lengkap, m.username) AS member_nama, \
    m.waktu_tersimpan AS member_waktu_tersimpan, m.kadaluarsa_pada AS member_kadaluarsa, \
    p.nama AS paket_nama, p.durasi_menit AS paket_durasi_menit, p.harga AS paket_harga, \
    p.kadaluarsa_hari AS paket_kadaluarsa_hari \
    FROM sesi s LEFT JOIN pc ON pc.id = s.pc_id LEFT JOIN grup g ON g.id = pc.grup_id \
    LEFT JOIN member m ON m.id = s.member_id LEFT JOIN paket p ON p.id = s.paket_id";

pub async fn get_by_id(pool: &SqlitePool, id: i64) -> sqlx::Result<Option<Sesi>> {
    sqlx::query_as::<_, Sesi>(&format!("{SELECT} WHERE s.id = ?"))
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn get_aktif_by_id(pool: &SqlitePool, id: i64) -> sqlx::Result<Option<Sesi>> {
    sqlx::query_as::<_, Sesi>(&format!("{SELECT} WHERE s.id = ? AND s.status = 'aktif'"))
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn get_aktif_by_pc(pool: &SqlitePool, pc_id: i64) -> sqlx::Result<Option<Sesi>> {
    sqlx::query_as::<_, Sesi>(&format!(
        "{SELECT} WHERE s.pc_id = ? AND s.status = 'aktif'"
    ))
    .bind(pc_id)
    .fetch_optional(pool)
    .await
}

pub async fn get_aktif_by_member(pool: &SqlitePool, member_id: i64) -> sqlx::Result<Option<Sesi>> {
    sqlx::query_as::<_, Sesi>(&format!(
        "{SELECT} WHERE s.member_id = ? AND s.status = 'aktif'"
    ))
    .bind(member_id)
    .fetch_optional(pool)
    .await
}

pub async fn get_all_aktif_by_member(pool: &SqlitePool, member_id: i64) -> sqlx::Result<Vec<Sesi>> {
    sqlx::query_as::<_, Sesi>(&format!(
        "{SELECT} WHERE s.member_id = ? AND s.status = 'aktif'"
    ))
    .bind(member_id)
    .fetch_all(pool)
    .await
}

pub async fn get_all_aktif(pool: &SqlitePool) -> sqlx::Result<Vec<Sesi>> {
    sqlx::query_as::<_, Sesi>(&format!("{SELECT} WHERE s.status = 'aktif'"))
        .fetch_all(pool)
        .await
}

/// Sesi aktif yang heartbeat/mulai-nya sudah lewat batas (kandidat blackout).
pub async fn stale_aktif(pool: &SqlitePool, batas: &str) -> sqlx::Result<Vec<Sesi>> {
    sqlx::query_as::<_, Sesi>(&format!(
        "{SELECT} WHERE s.status = 'aktif' AND s.is_blackout_suspect = 0 \
         AND (s.last_sync < ? OR (s.last_sync IS NULL AND s.mulai_pada < ?))"
    ))
    .bind(batas)
    .bind(batas)
    .fetch_all(pool)
    .await
}

/// Rantai sesi satu member/guest setelah pindah PC (root + turunannya).
pub async fn chain_ids(pool: &SqlitePool, root: i64) -> sqlx::Result<Vec<i64>> {
    sqlx::query_scalar("SELECT id FROM sesi WHERE id = ? OR sesi_asal_id = ?")
        .bind(root)
        .bind(root)
        .fetch_all(pool)
        .await
}

pub async fn count_aktif(pool: &SqlitePool) -> sqlx::Result<i64> {
    sqlx::query_scalar("SELECT COUNT(*) FROM sesi WHERE status = 'aktif'")
        .fetch_one(pool)
        .await
}

pub async fn count_aktif_by_paket(pool: &SqlitePool, paket_id: i64) -> sqlx::Result<i64> {
    sqlx::query_scalar("SELECT COUNT(*) FROM sesi WHERE paket_id = ? AND status = 'aktif'")
        .bind(paket_id)
        .fetch_one(pool)
        .await
}

/// Daftar audit blackout; rentang tanggal lokal dikonversi pemanggil ke batas UTC.
pub async fn blackout_audit_list(
    pool: &SqlitePool,
    range: Option<(String, String)>,
) -> sqlx::Result<Vec<Sesi>> {
    let sql = format!(
        "{SELECT} WHERE s.is_blackout_suspect = 1{} ORDER BY s.mulai_pada DESC",
        if range.is_some() {
            " AND s.mulai_pada >= ? AND s.mulai_pada < ?"
        } else {
            ""
        }
    );
    let mut q = sqlx::query_as::<_, Sesi>(&sql);
    if let Some((start, end)) = range {
        q = q.bind(start).bind(end);
    }
    q.fetch_all(pool).await
}

pub async fn blackout_audit_dates(pool: &SqlitePool) -> sqlx::Result<Vec<String>> {
    sqlx::query_scalar(
        "SELECT mulai_pada FROM sesi WHERE is_blackout_suspect = 1 AND mulai_pada IS NOT NULL",
    )
    .fetch_all(pool)
    .await
}

/// Hapus catatan audit yang sudah resolved pada satu rentang tanggal (UTC).
pub async fn delete_resolved_blackout(
    pool: &SqlitePool,
    start: &str,
    end: &str,
) -> sqlx::Result<u64> {
    let res = sqlx::query(
        "DELETE FROM sesi WHERE is_blackout_suspect = 1 AND is_blackout_resolved = 1 \
         AND mulai_pada >= ? AND mulai_pada < ?",
    )
    .bind(start)
    .bind(end)
    .execute(pool)
    .await?;
    Ok(res.rows_affected())
}
