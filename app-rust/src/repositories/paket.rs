//! Query tabel `paket` (+ join nama/warna grup).

use crate::models::paket::Paket;
use sqlx::SqlitePool;

const KOLOM: &str = "SELECT p.id, p.nama, p.durasi_menit, p.harga, p.kadaluarsa_hari, p.grup_id, \
     p.aktif, p.dibuat_pada, g.nama AS grup_nama, g.warna AS grup_warna \
     FROM paket p LEFT JOIN grup g ON g.id = p.grup_id";

pub async fn get_all(
    pool: &SqlitePool,
    aktif_only: bool,
    grup_id: Option<i64>,
    search: Option<&str>,
) -> anyhow::Result<Vec<Paket>> {
    let mut sql = KOLOM.to_string();
    let mut clauses = Vec::new();
    if aktif_only {
        clauses.push("p.aktif = 1".to_string());
    }
    if grup_id.is_some() {
        clauses.push("p.grup_id = ?".to_string());
    }
    if search.is_some() {
        clauses.push("(LOWER(p.nama) LIKE ? OR CAST(p.harga AS TEXT) LIKE ?)".to_string());
    }
    if !clauses.is_empty() {
        sql.push_str(&format!(" WHERE {}", clauses.join(" AND ")));
    }
    sql.push_str(" ORDER BY p.harga ASC, p.nama ASC");

    let mut q = sqlx::query_as::<_, Paket>(&sql);
    if let Some(gid) = grup_id {
        q = q.bind(gid);
    }
    if let Some(term) = search {
        let like = format!("%{}%", term.to_lowercase());
        q = q.bind(like.clone()).bind(like);
    }
    Ok(q.fetch_all(pool).await?)
}

pub async fn get_by_id(pool: &SqlitePool, id: i64) -> anyhow::Result<Option<Paket>> {
    let sql = format!("{KOLOM} WHERE p.id = ?");
    Ok(sqlx::query_as::<_, Paket>(&sql)
        .bind(id)
        .fetch_optional(pool)
        .await?)
}

pub async fn find_by_nama(pool: &SqlitePool, nama: &str) -> anyhow::Result<Option<Paket>> {
    let sql = format!("{KOLOM} WHERE LOWER(p.nama) = LOWER(?)");
    Ok(sqlx::query_as::<_, Paket>(&sql)
        .bind(nama)
        .fetch_optional(pool)
        .await?)
}

pub async fn find_by_nama_exclude(
    pool: &SqlitePool,
    nama: &str,
    exclude_id: i64,
) -> anyhow::Result<Option<Paket>> {
    let sql = format!("{KOLOM} WHERE LOWER(p.nama) = LOWER(?) AND p.id <> ?");
    Ok(sqlx::query_as::<_, Paket>(&sql)
        .bind(nama)
        .bind(exclude_id)
        .fetch_optional(pool)
        .await?)
}

pub async fn count_aktif_sesi(pool: &SqlitePool, paket_id: i64) -> anyhow::Result<i64> {
    let row: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM sesi WHERE paket_id = ? AND status = 'aktif'")
            .bind(paket_id)
            .fetch_one(pool)
            .await?;
    Ok(row.0)
}
