//! Query tiket perawatan.

use sqlx::SqlitePool;

use crate::models::maintenance::Tiket;

const KOLOM: &str = "t.id, t.pc_id, t.reporter, t.kategori, t.prioritas, t.judul, t.deskripsi,
     t.status, t.resolusi, t.biaya, t.created_at, t.updated_at, t.resolved_at, t.resolved_by,
     p.kode AS pc_kode";

const JOIN: &str = "FROM maintenance_ticket t LEFT JOIN pc p ON p.id = t.pc_id";

pub async fn list(
    pool: &SqlitePool,
    status: Option<&str>,
    pc_id: Option<i64>,
    grup: Option<&str>,
    limit: i64,
) -> sqlx::Result<Vec<Tiket>> {
    let mut sql = format!("SELECT {KOLOM} {JOIN} WHERE 1=1");
    if pc_id.is_some() {
        sql.push_str(" AND t.pc_id = ?");
    } else if grup.is_some() {
        sql.push_str(" AND p.grup_id = (SELECT id FROM grup WHERE nama = ?)");
    }
    if status.is_some() {
        sql.push_str(" AND t.status = ?");
    }
    sql.push_str(" ORDER BY t.created_at DESC LIMIT ?");

    let mut q = sqlx::query_as::<_, Tiket>(&sql);
    if let Some(v) = pc_id {
        q = q.bind(v);
    } else if let Some(g) = grup {
        q = q.bind(g.to_string());
    }
    if let Some(s) = status {
        q = q.bind(s.to_string());
    }
    q.bind(limit).fetch_all(pool).await
}

pub async fn get(pool: &SqlitePool, id: i64) -> sqlx::Result<Option<Tiket>> {
    sqlx::query_as(&format!("SELECT {KOLOM} {JOIN} WHERE t.id = ?"))
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn insert(
    pool: &SqlitePool,
    pc_id: i64,
    reporter: &str,
    kategori: &str,
    prioritas: &str,
    judul: &str,
    deskripsi: Option<&str>,
    now: &str,
) -> sqlx::Result<i64> {
    sqlx::query_scalar(
        "INSERT INTO maintenance_ticket
           (pc_id, reporter, kategori, prioritas, judul, deskripsi, status, biaya, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'BARU', 0, ?, ?) RETURNING id",
    )
    .bind(pc_id)
    .bind(reporter)
    .bind(kategori)
    .bind(prioritas)
    .bind(judul)
    .bind(deskripsi)
    .bind(now)
    .bind(now)
    .fetch_one(pool)
    .await
}

pub async fn set_status(
    pool: &SqlitePool,
    id: i64,
    status: &str,
    resolusi: Option<&str>,
    biaya: i64,
    resolved_by: Option<&str>,
    resolved_at: Option<&str>,
    now: &str,
) -> sqlx::Result<()> {
    sqlx::query(
        "UPDATE maintenance_ticket
            SET status = ?, resolusi = COALESCE(?, resolusi), biaya = ?,
                resolved_by = COALESCE(?, resolved_by), resolved_at = COALESCE(?, resolved_at),
                updated_at = ?
          WHERE id = ?",
    )
    .bind(status)
    .bind(resolusi)
    .bind(biaya)
    .bind(resolved_by)
    .bind(resolved_at)
    .bind(now)
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete(pool: &SqlitePool, id: i64) -> sqlx::Result<()> {
    sqlx::query("DELETE FROM maintenance_ticket WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn ada_kritis_terbuka(pool: &SqlitePool, pc_id: i64, kecuali: i64) -> sqlx::Result<bool> {
    let jumlah: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM maintenance_ticket
          WHERE pc_id = ? AND id != ? AND prioritas = 'KRITIS' AND status IN ('BARU','DIPROSES')",
    )
    .bind(pc_id)
    .bind(kecuali)
    .fetch_one(pool)
    .await?;
    Ok(jumlah > 0)
}

pub async fn set_pc_aktif(pool: &SqlitePool, pc_id: i64, aktif: bool) -> sqlx::Result<()> {
    sqlx::query("UPDATE pc SET aktif = ? WHERE id = ?")
        .bind(if aktif { 1 } else { 0 })
        .bind(pc_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn report(
    pool: &SqlitePool,
    start: Option<&str>,
    end: Option<&str>,
    pc_id: Option<i64>,
    grup: Option<&str>,
    kategori: Option<&str>,
) -> sqlx::Result<(i64, i64, Vec<(String, i64)>, Vec<Tiket>)> {
    let mut sql = format!("SELECT {KOLOM} {JOIN} WHERE t.status = 'SELESAI'");
    if start.is_some() {
        sql.push_str(" AND t.resolved_at >= ?");
    }
    if end.is_some() {
        sql.push_str(" AND t.resolved_at < ?");
    }
    if pc_id.is_some() {
        sql.push_str(" AND t.pc_id = ?");
    } else if grup.is_some() {
        sql.push_str(" AND p.grup_id = (SELECT id FROM grup WHERE nama = ?)");
    }
    if kategori.is_some() {
        sql.push_str(" AND t.kategori = ?");
    }
    sql.push_str(" ORDER BY t.resolved_at DESC");

    let mut q = sqlx::query_as::<_, Tiket>(&sql);
    if let Some(v) = start {
        q = q.bind(v.to_string());
    }
    if let Some(v) = end {
        q = q.bind(v.to_string());
    }
    if let Some(v) = pc_id {
        q = q.bind(v);
    } else if let Some(v) = grup {
        q = q.bind(v.to_string());
    }
    if let Some(v) = kategori {
        q = q.bind(v.to_string());
    }
    let baris = q.fetch_all(pool).await?;

    let total = baris.len() as i64;
    let biaya = baris.iter().map(|t| t.biaya.unwrap_or(0)).sum::<i64>();
    let mut per_kategori: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    for t in &baris {
        *per_kategori.entry(t.kategori.clone()).or_insert(0) += 1;
    }
    Ok((total, biaya, per_kategori.into_iter().collect(), baris))
}
