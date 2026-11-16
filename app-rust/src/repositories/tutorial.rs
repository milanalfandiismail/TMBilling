//! Query panduan sistem.

use sqlx::SqlitePool;

use crate::models::tutorial::Tutorial;

const KOLOM: &str = "id, title, icon, category, content, urutan, created_at, updated_at";

pub async fn get_all(pool: &SqlitePool) -> sqlx::Result<Vec<Tutorial>> {
    sqlx::query_as(&format!(
        "SELECT {KOLOM} FROM system_tutorials ORDER BY urutan ASC, id ASC"
    ))
    .fetch_all(pool)
    .await
}

pub async fn get_by_id(pool: &SqlitePool, id: i64) -> sqlx::Result<Option<Tutorial>> {
    sqlx::query_as(&format!(
        "SELECT {KOLOM} FROM system_tutorials WHERE id = ?"
    ))
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn insert(
    pool: &SqlitePool,
    title: &str,
    icon: Option<&str>,
    category: &str,
    content: &str,
    urutan: i64,
    now: &str,
) -> sqlx::Result<i64> {
    sqlx::query_scalar(
        "INSERT INTO system_tutorials (title, icon, category, content, urutan, created_at, updated_at)
         VALUES (?, COALESCE(?, '🌐'), ?, ?, ?, ?, ?) RETURNING id",
    )
    .bind(title)
    .bind(icon)
    .bind(category)
    .bind(content)
    .bind(urutan)
    .bind(now)
    .bind(now)
    .fetch_one(pool)
    .await
}

pub async fn update(
    pool: &SqlitePool,
    id: i64,
    title: Option<&str>,
    icon: Option<&str>,
    category: Option<&str>,
    content: Option<&str>,
    urutan: Option<i64>,
    now: &str,
) -> sqlx::Result<()> {
    sqlx::query(
        "UPDATE system_tutorials SET
            title = COALESCE(?, title),
            icon = COALESCE(?, icon),
            category = COALESCE(?, category),
            content = COALESCE(?, content),
            urutan = COALESCE(?, urutan),
            updated_at = ?
          WHERE id = ?",
    )
    .bind(title)
    .bind(icon)
    .bind(category)
    .bind(content)
    .bind(urutan)
    .bind(now)
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete(pool: &SqlitePool, id: i64) -> sqlx::Result<()> {
    sqlx::query("DELETE FROM system_tutorials WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn categories(pool: &SqlitePool) -> sqlx::Result<Vec<(String, i64)>> {
    sqlx::query_as::<_, (String, i64)>(
        "SELECT COALESCE(category, 'Umum') AS c, COUNT(*) FROM system_tutorials GROUP BY c ORDER BY c ASC",
    )
    .fetch_all(pool)
    .await
}

pub async fn delete_category(pool: &SqlitePool, nama: &str) -> sqlx::Result<i64> {
    let hasil = sqlx::query("UPDATE system_tutorials SET category = 'Kosong' WHERE category = ?")
        .bind(nama)
        .execute(pool)
        .await?;
    Ok(hasil.rows_affected() as i64)
}

pub async fn count(pool: &SqlitePool) -> sqlx::Result<i64> {
    sqlx::query_scalar("SELECT COUNT(*) FROM system_tutorials")
        .fetch_one(pool)
        .await
}
