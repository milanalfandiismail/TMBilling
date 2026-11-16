//! Query tabel `grup`.

use crate::models::grup::Grup;
use sqlx::SqlitePool;

const KOLOM: &str =
    "SELECT g.id, g.nama, g.warna, g.keterangan, g.aktif, g.dibuat_pada FROM grup g";

pub async fn get_all(pool: &SqlitePool, aktif_only: bool) -> anyhow::Result<Vec<Grup>> {
    let sql = if aktif_only {
        format!("{KOLOM} WHERE g.aktif = 1 ORDER BY g.nama")
    } else {
        format!("{KOLOM} ORDER BY g.aktif DESC, g.nama")
    };
    Ok(sqlx::query_as::<_, Grup>(&sql).fetch_all(pool).await?)
}

pub async fn get_by_id(pool: &SqlitePool, id: i64) -> anyhow::Result<Option<Grup>> {
    let sql = format!("{KOLOM} WHERE g.id = ?");
    Ok(sqlx::query_as::<_, Grup>(&sql)
        .bind(id)
        .fetch_optional(pool)
        .await?)
}

pub async fn find_by_nama(pool: &SqlitePool, nama: &str) -> anyhow::Result<Option<Grup>> {
    let sql = format!("{KOLOM} WHERE LOWER(g.nama) = LOWER(?)");
    Ok(sqlx::query_as::<_, Grup>(&sql)
        .bind(nama)
        .fetch_optional(pool)
        .await?)
}
