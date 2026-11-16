//! Query member untuk sesi bermain (CRUD penuh menyusul Task 8).

use sqlx::SqlitePool;

use crate::models::member::Member;

const KOLOM: &str = "SELECT id, username, password_hash, nama_lengkap, email, no_hp, grup_id, \
    COALESCE(aktif, 1) AS aktif, dibuat_pada, COALESCE(waktu_tersimpan, 0) AS waktu_tersimpan, \
    kadaluarsa_pada FROM member";

pub async fn get_by_username(pool: &SqlitePool, username: &str) -> sqlx::Result<Option<Member>> {
    sqlx::query_as::<_, Member>(&format!("{KOLOM} WHERE username = ?"))
        .bind(username)
        .fetch_optional(pool)
        .await
}

pub async fn get_by_id(pool: &SqlitePool, id: i64) -> sqlx::Result<Option<Member>> {
    sqlx::query_as::<_, Member>(&format!("{KOLOM} WHERE id = ?"))
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn set_waktu_tersimpan(pool: &SqlitePool, id: i64, menit: i64) -> sqlx::Result<()> {
    sqlx::query("UPDATE member SET waktu_tersimpan = ? WHERE id = ?")
        .bind(menit)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}
