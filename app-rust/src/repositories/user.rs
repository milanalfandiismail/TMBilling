//! Query tabel `user`.

use crate::models::user::User;
use anyhow::Result;
use sqlx::SqlitePool;

pub async fn get_by_username(pool: &SqlitePool, username: &str) -> Result<Option<User>> {
    Ok(
        sqlx::query_as::<_, User>("SELECT * FROM user WHERE username = ? AND aktif = 1 LIMIT 1")
            .bind(username)
            .fetch_optional(pool)
            .await?,
    )
}

pub async fn find_by_username(pool: &SqlitePool, username: &str) -> Result<Option<User>> {
    Ok(
        sqlx::query_as::<_, User>("SELECT * FROM user WHERE username = ? LIMIT 1")
            .bind(username)
            .fetch_optional(pool)
            .await?,
    )
}

pub async fn get_by_id(pool: &SqlitePool, id: i64) -> Result<Option<User>> {
    Ok(sqlx::query_as::<_, User>("SELECT * FROM user WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await?)
}

pub async fn get_all(pool: &SqlitePool, aktif_only: bool) -> Result<Vec<User>> {
    let sql = if aktif_only {
        "SELECT * FROM user WHERE aktif = 1 ORDER BY id ASC"
    } else {
        "SELECT * FROM user ORDER BY id ASC"
    };
    Ok(sqlx::query_as::<_, User>(sql).fetch_all(pool).await?)
}

pub async fn count_active_admins(pool: &SqlitePool) -> Result<i64> {
    let (count,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM user WHERE role = 'admin' AND aktif = 1")
            .fetch_one(pool)
            .await?;
    Ok(count)
}

pub async fn count_all(pool: &SqlitePool) -> Result<i64> {
    let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM user")
        .fetch_one(pool)
        .await?;
    Ok(count)
}
