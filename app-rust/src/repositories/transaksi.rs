//! Query buku besar transaksi.

use sqlx::SqlitePool;

use crate::models::transaksi::Transaksi;

const SELECT: &str = "SELECT t.id, t.sesi_id, t.member_id, t.paket_id, t.user_id, t.jenis, \
    COALESCE(t.jumlah, 0) AS jumlah, COALESCE(t.menit, 0) AS menit, t.keterangan, \
    t.dibuat_pada, t.no_nota, COALESCE(t.is_refunded, 0) AS is_refunded, \
    t.metode_pembayaran, t.operator, p.nama AS paket_nama, p.durasi_menit AS paket_durasi_menit, \
    COALESCE(NULLIF(m.nama_lengkap, ''), m.username) AS member_nama, \
    s.nama_guest AS guest_nama, pck.kode AS pc_kode \
    FROM transaksi t LEFT JOIN paket p ON p.id = t.paket_id \
    LEFT JOIN member m ON m.id = t.member_id \
    LEFT JOIN sesi s ON s.id = t.sesi_id \
    LEFT JOIN pc pck ON pck.id = s.pc_id";

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

/// Menandai transaksi sudah direfund secara atomik di dalam SQL Transaction aktif.
pub async fn claim_refund_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    id: i64,
) -> sqlx::Result<bool> {
    let res = sqlx::query("UPDATE transaksi SET is_refunded = 1 WHERE id = ? AND is_refunded = 0")
        .bind(id)
        .execute(&mut **tx)
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

// ---------- Laporan ----------

/// Klausa WHERE laporan. Semua nilai di-bind sebagai TEXT; SQLite menerapkan
/// affinity kolom sehingga perbandingan dengan INTEGER tetap cocok.
fn filter_sql(
    tanggal: Option<&str>,
    kasir_id: Option<i64>,
    metode: Option<&str>,
    q: Option<&str>,
    tz_name: &str,
) -> (String, Vec<String>) {
    let mut parts: Vec<String> = Vec::new();
    let mut binds: Vec<String> = Vec::new();
    if let Some(t) = tanggal {
        if let Some((start, end)) = crate::utils::time::day_range_utc_str(t, tz_name) {
            parts.push("(t.dibuat_pada >= ? AND t.dibuat_pada < ?)".into());
            binds.push(start);
            binds.push(end);
        } else {
            parts.push("1=0".into());
        }
    }
    if let Some(k) = kasir_id {
        parts.push("t.user_id = ?".into());
        binds.push(k.to_string());
    }
    if let Some(m) = metode {
        parts.push("(CASE WHEN COALESCE(t.metode_pembayaran,'') IN ('','Cash') THEN 'Tunai' ELSE t.metode_pembayaran END) = ?".into());
        binds.push(m.to_string());
    }
    if let Some(kata) = q.filter(|k| !k.is_empty()) {
        parts.push(
            "(COALESCE(t.no_nota,'') LIKE ? OR COALESCE(t.keterangan,'') LIKE ? OR COALESCE(t.operator,'') LIKE ?)".into(),
        );
        let like = format!("%{kata}%");
        binds.extend([like.clone(), like.clone(), like]);
    }
    let clause = if parts.is_empty() {
        String::new()
    } else {
        format!(" AND {}", parts.join(" AND "))
    };
    (clause, binds)
}

async fn scalar(sql: &str, binds: &[String], pool: &SqlitePool) -> sqlx::Result<i64> {
    let mut q = sqlx::query_scalar::<_, i64>(sql);
    for b in binds {
        q = q.bind(b.clone());
    }
    q.fetch_one(pool).await
}

const BILLING: &str = "t.jumlah > 0 AND t.jenis NOT IN ('tutup_sesi','pindah_pc','refund_paket')";

pub async fn total_pemasukan(
    pool: &SqlitePool,
    tanggal: Option<&str>,
    kasir_id: Option<i64>,
    metode: Option<&str>,
    tz_name: &str,
) -> sqlx::Result<i64> {
    let (clause, binds) = filter_sql(tanggal, kasir_id, metode, None, tz_name);
    scalar(
        &format!("SELECT COALESCE(SUM(t.jumlah),0) FROM transaksi t WHERE {BILLING}{clause}"),
        &binds,
        pool,
    )
    .await
}

pub async fn total_refund(
    pool: &SqlitePool,
    tanggal: Option<&str>,
    kasir_id: Option<i64>,
    metode: Option<&str>,
    tz_name: &str,
) -> sqlx::Result<i64> {
    let (clause, binds) = filter_sql(tanggal, kasir_id, metode, None, tz_name);
    scalar(
        &format!("SELECT COALESCE(SUM(ABS(t.jumlah)),0) FROM transaksi t WHERE t.jenis = 'refund_paket'{clause}"),
        &binds,
        pool,
    )
    .await
}

pub async fn pendapatan_kategori(
    pool: &SqlitePool,
    tipe: &str,
    tanggal: Option<&str>,
    kasir_id: Option<i64>,
    metode: Option<&str>,
    tz_name: &str,
) -> sqlx::Result<i64> {
    let (clause, binds) = filter_sql(tanggal, kasir_id, metode, None, tz_name);
    let mut semua = binds.clone();
    semua.insert(0, tipe.to_string());
    scalar(
        &format!(
            "SELECT COALESCE(SUM(t.jumlah),0) FROM transaksi t JOIN sesi s ON s.id = t.sesi_id
             WHERE {BILLING} AND s.tipe = ?{clause}"
        ),
        &semua,
        pool,
    )
    .await
}

/// `(metode, total)` billing per metode pembayaran (gross - refund).
pub async fn breakdown_metode(
    pool: &SqlitePool,
    tanggal: Option<&str>,
    kasir_id: Option<i64>,
    metode: Option<&str>,
    q: Option<&str>,
    tz_name: &str,
) -> sqlx::Result<Vec<(String, i64)>> {
    let (clause, binds) = filter_sql(tanggal, kasir_id, metode, q, tz_name);
    let sql = format!(
        "SELECT CASE WHEN COALESCE(t.metode_pembayaran,'') IN ('','Cash') THEN 'Tunai'
                     ELSE t.metode_pembayaran END AS m,
                COALESCE(SUM(t.jumlah),0)
         FROM transaksi t WHERE t.jenis NOT IN ('tutup_sesi','pindah_pc'){clause}
         GROUP BY m ORDER BY 2 DESC"
    );
    let mut q2 = sqlx::query_as::<_, (String, i64)>(&sql);
    for b in &binds {
        q2 = q2.bind(b.clone());
    }
    q2.fetch_all(pool).await
}

pub async fn get_by_no_nota(pool: &SqlitePool, no_nota: &str) -> sqlx::Result<Option<Transaksi>> {
    sqlx::query_as::<_, Transaksi>(&format!("{SELECT} WHERE t.no_nota = ? LIMIT 1"))
        .bind(no_nota)
        .fetch_optional(pool)
        .await
}

pub async fn history_paginated(
    pool: &SqlitePool,
    tanggal: Option<&str>,
    kasir_id: Option<i64>,
    metode: Option<&str>,
    q: Option<&str>,
    limit: i64,
    offset: i64,
    tz_name: &str,
) -> sqlx::Result<(Vec<Transaksi>, i64)> {
    let (clause, binds) = filter_sql(tanggal, kasir_id, metode, q, tz_name);
    // Sama seperti Python: nota tutup sesi (no_nota NULL) bukan baris laporan billing.
    let total = scalar(
        &format!("SELECT COUNT(*) FROM transaksi t WHERE t.no_nota IS NOT NULL{clause}"),
        &binds,
        pool,
    )
    .await?;
    let sql = format!(
        "{SELECT} WHERE t.no_nota IS NOT NULL{clause} ORDER BY t.id DESC LIMIT ? OFFSET ?"
    );
    let mut s = sqlx::query_as::<_, Transaksi>(&sql);
    for b in &binds {
        s = s.bind(b.clone());
    }
    let rows = s.bind(limit).bind(offset).fetch_all(pool).await?;
    Ok((rows, total))
}

pub async fn tanggal_unik(pool: &SqlitePool, tz_name: &str) -> sqlx::Result<Vec<String>> {
    let mod_str = crate::utils::time::sqlite_tz_modifier(tz_name);
    sqlx::query_scalar(
        "SELECT DISTINCT date(dibuat_pada, ?) AS t FROM transaksi WHERE dibuat_pada IS NOT NULL ORDER BY t DESC",
    )
    .bind(mod_str)
    .fetch_all(pool)
    .await
}

pub async fn delete_by_id(pool: &SqlitePool, id: i64) -> sqlx::Result<bool> {
    let res = sqlx::query("DELETE FROM transaksi WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(res.rows_affected() > 0)
}

pub async fn delete_by_date(pool: &SqlitePool, tanggal: &str, tz_name: &str) -> sqlx::Result<u64> {
    let Some((start, end)) = crate::utils::time::day_range_utc_str(tanggal, tz_name) else {
        return Ok(0);
    };
    let res = sqlx::query("DELETE FROM transaksi WHERE dibuat_pada >= ? AND dibuat_pada < ?")
        .bind(start)
        .bind(end)
        .execute(pool)
        .await?;
    Ok(res.rows_affected())
}

pub async fn delete_all(pool: &SqlitePool) -> sqlx::Result<u64> {
    let res = sqlx::query("DELETE FROM transaksi").execute(pool).await?;
    Ok(res.rows_affected())
}

pub async fn distinct_remote_operators(pool: &SqlitePool) -> sqlx::Result<Vec<String>> {
    sqlx::query_scalar(
        "SELECT DISTINCT operator FROM transaksi WHERE operator IS NOT NULL AND operator != '' ORDER BY operator",
    )
    .fetch_all(pool)
    .await
}
