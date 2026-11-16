//! Query tabel `pc`.

use crate::models::pc::{Pc, SesiRingkas};
use sqlx::SqlitePool;

const KOLOM: &str = "SELECT p.id, p.kode, p.nama, p.ip_address, p.mac_address, p.grup_id, p.zona, \
    p.last_activity, p.aktif, p.is_admin_mode, p.pos_x, p.pos_y, \
    g.nama AS grup_nama, g.warna AS grup_warna \
    FROM pc p LEFT JOIN grup g ON g.id = p.grup_id";

pub async fn get_all(
    pool: &SqlitePool,
    aktif_only: bool,
    grup_id: Option<i64>,
    search: Option<&str>,
) -> anyhow::Result<Vec<Pc>> {
    let mut sql = KOLOM.to_string();
    let mut w: Vec<String> = Vec::new();
    if aktif_only {
        w.push("p.aktif = 1".into());
    }
    if grup_id.is_some() {
        w.push("p.grup_id = ?".into());
    }
    if search.is_some() {
        w.push("(p.kode LIKE ? OR p.nama LIKE ? OR p.ip_address LIKE ?)".into());
    }
    if !w.is_empty() {
        sql.push_str(&format!(" WHERE {}", w.join(" AND ")));
    }
    let mut q = sqlx::query_as::<_, Pc>(&sql);
    if let Some(g) = grup_id {
        q = q.bind(g);
    }
    if let Some(s) = search {
        let like = format!("%{s}%");
        q = q.bind(like.clone()).bind(like.clone()).bind(like);
    }
    Ok(q.fetch_all(pool).await?)
}

pub async fn get_by_id(pool: &SqlitePool, id: i64) -> anyhow::Result<Option<Pc>> {
    let sql = format!("{KOLOM} WHERE p.id = ?");
    Ok(sqlx::query_as::<_, Pc>(&sql)
        .bind(id)
        .fetch_optional(pool)
        .await?)
}

pub async fn find_by_kode(pool: &SqlitePool, kode: &str) -> anyhow::Result<Option<Pc>> {
    let sql = format!("{KOLOM} WHERE p.kode = ?");
    Ok(sqlx::query_as::<_, Pc>(&sql)
        .bind(kode)
        .fetch_optional(pool)
        .await?)
}

pub async fn find_by_ip(pool: &SqlitePool, ip: &str) -> anyhow::Result<Option<Pc>> {
    let sql = format!("{KOLOM} WHERE p.ip_address = ?");
    Ok(sqlx::query_as::<_, Pc>(&sql)
        .bind(ip)
        .fetch_optional(pool)
        .await?)
}

pub async fn find_by_mac(pool: &SqlitePool, mac: &str) -> anyhow::Result<Option<Pc>> {
    let sql = format!("{KOLOM} WHERE p.mac_address = ?");
    Ok(sqlx::query_as::<_, Pc>(&sql)
        .bind(mac)
        .fetch_optional(pool)
        .await?)
}

pub async fn find_ip_exclude(pool: &SqlitePool, ip: &str, id: i64) -> anyhow::Result<Option<Pc>> {
    let sql = format!("{KOLOM} WHERE p.ip_address = ? AND p.id <> ?");
    Ok(sqlx::query_as::<_, Pc>(&sql)
        .bind(ip)
        .bind(id)
        .fetch_optional(pool)
        .await?)
}

pub async fn find_mac_exclude(pool: &SqlitePool, mac: &str, id: i64) -> anyhow::Result<Option<Pc>> {
    let sql = format!("{KOLOM} WHERE p.mac_address = ? AND p.id <> ?");
    Ok(sqlx::query_as::<_, Pc>(&sql)
        .bind(mac)
        .bind(id)
        .fetch_optional(pool)
        .await?)
}

/// Sesi aktif terbaru per PC, satu query untuk seluruh daftar (hindari N+1).
pub async fn sesi_map(
    pool: &SqlitePool,
) -> anyhow::Result<std::collections::HashMap<i64, SesiRingkas>> {
    let rows: Vec<(i64, i64, Option<String>, Option<String>, Option<bool>)> = sqlx::query_as(
        "SELECT pc_id, id, tipe, nama_guest, is_afk FROM sesi WHERE status = 'aktif' AND pc_id IS NOT NULL ORDER BY id DESC",
    )
    .fetch_all(pool)
    .await?;
    let mut map = std::collections::HashMap::new();
    for (pc_id, id, tipe, nama_guest, is_afk) in rows {
        map.entry(pc_id).or_insert(SesiRingkas {
            id,
            tipe,
            nama_guest,
            is_afk,
        });
    }
    Ok(map)
}

pub async fn count_aktif_sesi(pool: &SqlitePool, pc_id: i64) -> anyhow::Result<i64> {
    let row: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM sesi WHERE pc_id = ? AND status = 'aktif'")
            .bind(pc_id)
            .fetch_one(pool)
            .await?;
    Ok(row.0)
}

pub async fn set_mac(pool: &SqlitePool, pc_id: i64, mac: &str) -> sqlx::Result<()> {
    sqlx::query("UPDATE pc SET mac_address = ? WHERE id = ?")
        .bind(mac)
        .bind(pc_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn set_admin_mode(pool: &SqlitePool, pc_id: i64, aktif: bool) -> sqlx::Result<()> {
    sqlx::query("UPDATE pc SET is_admin_mode = ?, last_activity = ? WHERE id = ?")
        .bind(if aktif { 1 } else { 0 })
        .bind(crate::utils::time::db_str(crate::utils::time::now_db()))
        .bind(pc_id)
        .execute(pool)
        .await?;
    Ok(())
}
