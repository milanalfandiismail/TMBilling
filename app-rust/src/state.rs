//! State global yang dibagikan ke setiap handler.

use crate::cache::online::OnlineStatusStore;
use crate::cache::pc_network::PcNetworkCache;
use crate::cache::settings::SettingsCache;
use crate::config::{paths, Config};
use crate::db::write_lock::WriteLock;
use crate::utils::logger;
use anyhow::Result;
use sqlx::SqlitePool;
use tokio::sync::MutexGuard;

pub struct AppState {
    pub cfg: Config,
    pub pool: SqlitePool,
    pub settings: SettingsCache,
    pub online: OnlineStatusStore,
    pub pc_network: PcNetworkCache,
    write: WriteLock,
}

impl AppState {
    pub async fn new(cfg: Config) -> Result<Self> {
        paths::ensure(&cfg)?;
        logger::init(&cfg.logs_dir, &cfg.timezone);
        let pool = crate::db::open(&cfg.db_path).await?;
        let report =
            crate::db::migrate::ensure_schema(&pool, &cfg.db_path, &cfg.backup_dir).await?;
        if report.changed() {
            tracing::info!(
                fresh = report.fresh,
                tables = report.created_tables,
                columns = report.added_columns,
                indexes = report.created_indexes,
                snapshot = report.snapshot.as_ref().map(|p| p.display().to_string()),
                "skema database disiapkan"
            );
        }
        let state = Self {
            cfg,
            pool,
            settings: SettingsCache::new(),
            online: OnlineStatusStore::new(),
            pc_network: PcNetworkCache::new(),
            write: WriteLock::new(),
        };
        crate::services::settings::ip_whitelist::seed_defaults(&state).await?;
        crate::services::auth::bootstrap::ensure_initial_admin(&state).await?;
        Ok(state)
    }

    /// Seluruh jalur baca-lalu-tulis memakai gerbang ini.
    pub async fn write(&self) -> MutexGuard<'_, ()> {
        self.write.acquire().await
    }
}
