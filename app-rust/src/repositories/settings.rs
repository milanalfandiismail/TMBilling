//! Pembacaan tabel `settings` (key-value) langsung dari pool.

use sqlx::SqlitePool;

/// Nilai setting; `default` dipakai bila baris tidak ada.
pub async fn get(pool: &SqlitePool, key: &str, default: &str) -> String {
    let row: Option<(String,)> = sqlx::query_as("SELECT value FROM settings WHERE key = ?")
        .bind(key)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten();
    row.map(|r| r.0).unwrap_or_else(|| default.to_string())
}

pub async fn set(pool: &SqlitePool, key: &str, value: &str) -> anyhow::Result<()> {
    sqlx::query(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(key)
    .bind(value)
    .execute(pool)
    .await?;
    Ok(())
}
