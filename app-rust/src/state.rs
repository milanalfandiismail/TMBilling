//! State global yang dibagikan ke setiap handler.

use crate::config::{paths, Config};
use crate::db::write_lock::WriteLock;
use crate::utils::logger;
use anyhow::Result;
use sqlx::SqlitePool;
use tokio::sync::MutexGuard;

pub struct AppState {
    pub cfg: Config,
    pub pool: SqlitePool,
    write: WriteLock,
}

impl AppState {
    pub async fn new(cfg: Config) -> Result<Self> {
        paths::ensure(&cfg)?;
        logger::init(&cfg.logs_dir, &cfg.timezone);
        let pool = crate::db::open(&cfg.db_path).await?;
        Ok(Self { cfg, pool, write: WriteLock::new() })
    }

    /// Seluruh jalur baca-lalu-tulis memakai gerbang ini.
    pub async fn write(&self) -> MutexGuard<'_, ()> {
        self.write.acquire().await
    }
}
