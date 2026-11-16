//! Pool SQLite bersama dan gerbang tulis.

pub mod migrate;
pub mod write_lock;

use anyhow::{Context, Result};
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::path::Path;
use std::str::FromStr;
use std::time::Duration;

pub async fn open(path: &Path) -> Result<SqlitePool> {
    if let Some(parent) = path.parent() { std::fs::create_dir_all(parent)?; }
    let opts = SqliteConnectOptions::from_str(&format!("sqlite://{}", path.display()))?
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .busy_timeout(Duration::from_secs(30))
        .foreign_keys(true);
    SqlitePoolOptions::new()
        .max_connections(8)
        .connect_with(opts)
        .await
        .with_context(|| format!("gagal membuka database {}", path.display()))
}
