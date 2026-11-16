//! Query turnamen, tahap, tim, dan match.

use sqlx::SqlitePool;

use crate::models::tournament::{Match, Tahap, Tim, Turnamen};

const KOLOM_T: &str = "id, nama, deskripsi, status, dibuat_pada";
const KOLOM_S: &str = "id, turnamen_id, nama, tipe_format, urutan, status, dibuat_pada";
const KOLOM_M: &str = "id, turnamen_id, tahap_id, round_number, match_number, tim1_id, tim2_id, skor1, skor2, pemenang_id, bo_format, next_match_id";

pub async fn get_all(pool: &SqlitePool) -> sqlx::Result<Vec<Turnamen>> {
    sqlx::query_as(&format!("SELECT {KOLOM_T} FROM turnamen ORDER BY id DESC"))
        .fetch_all(pool)
        .await
}

pub async fn get_by_id(pool: &SqlitePool, id: i64) -> sqlx::Result<Option<Turnamen>> {
    sqlx::query_as(&format!("SELECT {KOLOM_T} FROM turnamen WHERE id = ?"))
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn get_by_nama(pool: &SqlitePool, nama: &str) -> sqlx::Result<Option<Turnamen>> {
    sqlx::query_as(&format!("SELECT {KOLOM_T} FROM turnamen WHERE nama = ?"))
        .bind(nama)
        .fetch_optional(pool)
        .await
}

pub async fn stages(pool: &SqlitePool, turnamen_id: i64) -> sqlx::Result<Vec<Tahap>> {
    sqlx::query_as(&format!(
        "SELECT {KOLOM_S} FROM turnamen_tahap WHERE turnamen_id = ? ORDER BY urutan ASC, id ASC"
    ))
    .bind(turnamen_id)
    .fetch_all(pool)
    .await
}

pub async fn get_stage(pool: &SqlitePool, id: i64) -> sqlx::Result<Option<Tahap>> {
    sqlx::query_as(&format!(
        "SELECT {KOLOM_S} FROM turnamen_tahap WHERE id = ?"
    ))
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn teams(pool: &SqlitePool, turnamen_id: i64) -> sqlx::Result<Vec<Tim>> {
    sqlx::query_as(
        "SELECT id, turnamen_id, nama_tim, status_aktif FROM turnamen_tim WHERE turnamen_id = ? ORDER BY id ASC",
    )
    .bind(turnamen_id)
    .fetch_all(pool)
    .await
}

pub async fn teams_by_ids(
    pool: &SqlitePool,
    ids: &[i64],
    turnamen_id: i64,
) -> sqlx::Result<Vec<Tim>> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let daftar = ids
        .iter()
        .map(|v| v.to_string())
        .collect::<Vec<_>>()
        .join(",");
    sqlx::query_as(&format!(
        "SELECT id, turnamen_id, nama_tim, status_aktif FROM turnamen_tim
         WHERE turnamen_id = ? AND id IN ({daftar}) ORDER BY id ASC"
    ))
    .bind(turnamen_id)
    .fetch_all(pool)
    .await
}

pub async fn insert_team(
    pool: &SqlitePool,
    turnamen_id: i64,
    nama: &str,
    now: &str,
) -> sqlx::Result<i64> {
    sqlx::query_scalar(
        "INSERT INTO turnamen_tim (turnamen_id, nama_tim, status_aktif, dibuat_pada)
         VALUES (?, ?, 1, ?) RETURNING id",
    )
    .bind(turnamen_id)
    .bind(nama)
    .bind(now)
    .fetch_one(pool)
    .await
}

pub async fn insert_stage(
    pool: &SqlitePool,
    turnamen_id: i64,
    nama: &str,
    format: &str,
    urutan: i64,
    status: &str,
    now: &str,
) -> sqlx::Result<i64> {
    sqlx::query_scalar(
        "INSERT INTO turnamen_tahap (turnamen_id, nama, tipe_format, urutan, status, dibuat_pada)
         VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
    )
    .bind(turnamen_id)
    .bind(nama)
    .bind(format)
    .bind(urutan)
    .bind(status)
    .bind(now)
    .fetch_one(pool)
    .await
}

pub async fn insert_match(pool: &SqlitePool, m: &Match, now: &str) -> sqlx::Result<i64> {
    sqlx::query_scalar(
        "INSERT INTO turnamen_match
           (turnamen_id, tahap_id, round_number, match_number, tim1_id, tim2_id, skor1, skor2,
            pemenang_id, bo_format, next_match_id, dibuat_pada)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
    )
    .bind(m.turnamen_id)
    .bind(m.tahap_id)
    .bind(m.round_number)
    .bind(m.match_number)
    .bind(m.tim1_id)
    .bind(m.tim2_id)
    .bind(m.skor1.unwrap_or(0))
    .bind(m.skor2.unwrap_or(0))
    .bind(m.pemenang_id)
    .bind(m.bo_format.unwrap_or(1))
    .bind(m.next_match_id)
    .bind(now)
    .fetch_one(pool)
    .await
}

pub async fn matches_of_stage(pool: &SqlitePool, tahap_id: i64) -> sqlx::Result<Vec<Match>> {
    sqlx::query_as(&format!(
        "SELECT {KOLOM_M} FROM turnamen_match WHERE tahap_id = ?
         ORDER BY round_number ASC, match_number ASC"
    ))
    .bind(tahap_id)
    .fetch_all(pool)
    .await
}

pub async fn get_match(pool: &SqlitePool, id: i64) -> sqlx::Result<Option<Match>> {
    sqlx::query_as(&format!(
        "SELECT {KOLOM_M} FROM turnamen_match WHERE id = ?"
    ))
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn update_skor(
    pool: &SqlitePool,
    id: i64,
    skor1: i64,
    skor2: i64,
    pemenang: i64,
) -> sqlx::Result<()> {
    sqlx::query("UPDATE turnamen_match SET skor1 = ?, skor2 = ?, pemenang_id = ? WHERE id = ?")
        .bind(skor1)
        .bind(skor2)
        .bind(pemenang)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn set_slot(pool: &SqlitePool, match_id: i64, slot: i64, tim: i64) -> sqlx::Result<()> {
    let sql = if slot % 2 != 0 {
        "UPDATE turnamen_match SET tim1_id = ? WHERE id = ?"
    } else {
        "UPDATE turnamen_match SET tim2_id = ? WHERE id = ?"
    };
    sqlx::query(sql)
        .bind(tim)
        .bind(match_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn set_stage_status(pool: &SqlitePool, id: i64, status: &str) -> sqlx::Result<()> {
    sqlx::query("UPDATE turnamen_tahap SET status = ? WHERE id = ?")
        .bind(status)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn set_status(pool: &SqlitePool, id: i64, status: &str) -> sqlx::Result<()> {
    sqlx::query("UPDATE turnamen SET status = ? WHERE id = ?")
        .bind(status)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn delete(pool: &SqlitePool, id: i64) -> sqlx::Result<()> {
    for sql in [
        "DELETE FROM turnamen_match WHERE turnamen_id = ?",
        "DELETE FROM turnamen_tahap WHERE turnamen_id = ?",
        "DELETE FROM turnamen_tim WHERE turnamen_id = ?",
        "DELETE FROM turnamen WHERE id = ?",
    ] {
        sqlx::query(sql).bind(id).execute(pool).await?;
    }
    Ok(())
}

/// Peta id tim → nama untuk melengkapi payload match.
pub async fn nama_tim(
    pool: &SqlitePool,
    turnamen_id: i64,
) -> sqlx::Result<std::collections::HashMap<i64, String>> {
    let rows: Vec<(i64, String)> =
        sqlx::query_as("SELECT id, nama_tim FROM turnamen_tim WHERE turnamen_id = ?")
            .bind(turnamen_id)
            .fetch_all(pool)
            .await?;
    Ok(rows.into_iter().collect())
}
