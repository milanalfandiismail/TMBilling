//! State global yang dibagikan ke setiap handler.

use crate::cache::command::Queues;
use crate::cache::mismatch::MismatchStore;
use crate::cache::online::OnlineStatusStore;
use crate::cache::pc_network::PcNetworkCache;
use crate::cache::settings::SettingsCache;
use crate::cache::telemetry::{HardwareMetricsStore, ProcessMemoryStore, TelemetryHistoryStore};
use crate::cache::uptime::UptimeStore;
use crate::config::{paths, Config};
use crate::db::write_lock::WriteLock;
use crate::services::vnc::vnc_service::VncRegistry;
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
    pub commands: Queues,
    pub mismatch: MismatchStore,
    pub uptime: UptimeStore,
    pub metrics: HardwareMetricsStore,
    pub processes: ProcessMemoryStore,
    pub history: TelemetryHistoryStore,
    pub vnc: VncRegistry,
    pub backup_status: std::sync::Mutex<crate::services::backup::backup_service::ManualStatus>,
    pub cloudflared: std::sync::Mutex<Option<std::process::Child>>,
    pub revoked_before: std::sync::Mutex<std::collections::HashMap<i64, i64>>,
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
            commands: Queues::default(),
            mismatch: MismatchStore::default(),
            uptime: UptimeStore::default(),
            metrics: HardwareMetricsStore::default(),
            processes: ProcessMemoryStore::default(),
            history: TelemetryHistoryStore::default(),
            vnc: VncRegistry::default(),
            backup_status: std::sync::Mutex::new(Default::default()),
            cloudflared: std::sync::Mutex::new(None),
            revoked_before: std::sync::Mutex::new(std::collections::HashMap::new()),
            write: WriteLock::new(),
        };
        crate::services::settings::ip_whitelist::seed_defaults(&state).await?;
        crate::services::auth::bootstrap::ensure_initial_admin(&state).await?;
        let _ = crate::services::tutorial::tutorial_service::seed(&state).await;
        Ok(state)
    }

    /// Seluruh jalur baca-lalu-tulis memakai gerbang ini.
    pub async fn write(&self) -> MutexGuard<'_, ()> {
        self.write.acquire().await
    }
}
