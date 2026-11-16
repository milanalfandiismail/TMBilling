//! Query buku besar transaksi.

use sqlx::SqlitePool;

use crate::models::transaksi::Transaksi;

const SELECT: &str = "SELECT t.id, t.sesi_id, t.member_id, t.paket_id, t.user_id, t.jenis, \
    COALESCE(t.jumlah, 0) AS jumlah, COALESCE(t.menit, 0) AS menit, t.keterangan, \
    t.dibuat_pada, t.no_nota, COALESCE(t.is_refunded, 0) AS is_refunded, \
    t.metode_pembayaran, t.operator, p.nama AS paket_nama, p.durasi_menit AS paket_durasi_menit \
    FROM transaksi t LEFT JOIN paket p ON p.id = t.paket_id";

pub async fn get_by_id(pool: &SqlitePool, id: i64) -> sqlx::Result<Option<Transaksi>> {
    sqlx::query_as::<_, Transaksi>(&format!("{SELECT} WHERE t.id = ?"))
        .bind(id)
        .fetch_optional(pool)
        .await
}

/// Menandai transaksi sudah direfund secara atomik; `true` bila request ini menang.
pub async fn claim_refund(pool: &SqlitePool, id: i64) -> sqlx::Result<bool> {
    let res = sqlx::query("UPDATE transaksi SET is_refunded = 1 WHERE id = ? AND is_refunded = 0")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(res.rows_affected() == 1)
}

/// Nomor urut nota tertinggi untuk prefix `TM-YYYYMMDD-`.
pub async fn max_nota_seq(pool: &SqlitePool, date_str: &str) -> sqlx::Result<i64> {
    let prefix = format!("TM-{date_str}-");
    let seq: Option<i64> = sqlx::query_scalar(
        "SELECT MAX(CAST(substr(no_nota, ?) AS INTEGER)) FROM transaksi WHERE no_nota LIKE ?",
    )
    .bind(prefix.len() as i64 + 1)
    .bind(format!("{prefix}%"))
    .fetch_one(pool)
    .await?;
    Ok(seq.unwrap_or(0))
}

/// Riwayat pembelian paket guest yang belum direfund (untuk refund kasir).
pub async fn riwayat_paket_sesi(
    pool: &SqlitePool,
    sesi_ids: &[i64],
) -> sqlx::Result<Vec<Transaksi>> {
    if sesi_ids.is_empty() {
        return Ok(Vec::new());
    }
    let tanda = vec!["?"; sesi_ids.len()].join(",");
    let sql = format!(
        "{SELECT} WHERE t.sesi_id IN ({tanda}) \
         AND t.jenis IN ('beli_paket_guest', 'tambah_waktu_guest') \
         AND COALESCE(t.is_refunded, 0) = 0 ORDER BY t.dibuat_pada DESC"
    );
    let mut q = sqlx::query_as::<_, Transaksi>(&sql);
    for id in sesi_ids {
        q = q.bind(id);
    }
    q.fetch_all(pool).await
}

pub async fn riwayat_paket_member(
    pool: &SqlitePool,
    member_id: i64,
) -> sqlx::Result<Vec<Transaksi>> {
    let sql = format!(
        "{SELECT} WHERE t.member_id = ? AND t.jenis IN ('beli_paket_member') \
         AND COALESCE(t.is_refunded, 0) = 0 ORDER BY t.dibuat_pada DESC"
    );
    sqlx::query_as::<_, Transaksi>(&sql)
        .bind(member_id)
        .fetch_all(pool)
        .await
}
