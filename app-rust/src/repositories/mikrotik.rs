//! Konfigurasi MikroTik (satu baris / singleton).

use sqlx::SqlitePool;

#[derive(sqlx::FromRow, Clone)]
pub struct MikroTikConfig {
    pub id: i64,
    pub enabled: bool,
    pub host: Option<String>,
    pub port: i64,
    pub username: Option<String>,
    pub password: Option<String>,
    pub hotspot_profile: Option<String>,
}

pub async fn get_instance(pool: &SqlitePool) -> Result<MikroTikConfig, sqlx::Error> {
    if let Some(c) = sqlx::query_as::<_, MikroTikConfig>(
        "SELECT id, enabled, host, port, username, password, hotspot_profile FROM mikrotik_config LIMIT 1",
    )
    .fetch_optional(pool)
    .await?
    {
        return Ok(c);
    }
    sqlx::query(
        "INSERT INTO mikrotik_config (enabled, host, port, username, password, hotspot_profile)
         VALUES (0, '', 8728, '', '', 'default')",
    )
    .execute(pool)
    .await?;
    sqlx::query_as::<_, MikroTikConfig>(
        "SELECT id, enabled, host, port, username, password, hotspot_profile FROM mikrotik_config LIMIT 1",
    )
    .fetch_one(pool)
    .await
}

pub async fn save(
    pool: &SqlitePool,
    id: i64,
    enabled: bool,
    host: &str,
    port: i64,
    username: &str,
    password: Option<&str>,
    profile: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE mikrotik_config SET enabled = ?, host = ?, port = ?, username = ?,
            hotspot_profile = ? WHERE id = ?",
    )
    .bind(enabled)
    .bind(host)
    .bind(port)
    .bind(username)
    .bind(profile)
    .bind(id)
    .execute(pool)
    .await?;
    if let Some(p) = password {
        sqlx::query("UPDATE mikrotik_config SET password = ? WHERE id = ?")
            .bind(p)
            .bind(id)
            .execute(pool)
            .await?;
    }
    Ok(())
}
