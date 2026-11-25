//! Job berkala 60 detik: flush uptime, deteksi blackout, cleanup sesi, reaper VNC,
//! backup harian, dan prune log uptime.

use std::sync::Arc;
use std::time::Duration;

use crate::services;
use crate::state::AppState;

pub const TICK_SECONDS: u64 = 60;

pub fn spawn(st: Arc<AppState>) {
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(Duration::from_secs(TICK_SECONDS));
        loop {
            tick.tick().await;
            if let Err(e) = once(&st).await {
                tracing::warn!("job berkala gagal: {e}");
            }
        }
    });
}

async fn once(st: &Arc<AppState>) -> anyhow::Result<()> {
    flush_uptime(st).await?;
    services::blackout::blackout_service::deteksi(st, None)
        .await
        .map_err(|e| anyhow::anyhow!(e))?;
    let _ = services::sesi::sesi_service::cleanup_expired(st).await;
    let _ = services::sesi::sesi_service::cleanup_inactive_admin_sessions(st).await;
    services::vnc::vnc_service::reap(st);
    harian(st).await?;
    Ok(())
}

pub async fn flush_uptime(st: &Arc<AppState>) -> anyhow::Result<()> {
    let tz = services::settings::settings_service::active_timezone(st).await;
    let tanggal = crate::utils::time::today_local(&tz)
        .format("%Y-%m-%d")
        .to_string();
    let delta: Vec<(i64, i64, i64)> = st
        .uptime
        .drain()
        .into_iter()
        .map(|(id, acc)| (id, acc.online, acc.billing))
        .collect();
    if delta.is_empty() {
        return Ok(());
    }
    let _guard = st.write().await;
    crate::repositories::uptime::flush(&st.pool, &tanggal, &delta).await?;
    Ok(())
}

/// Backup otomatis bila arsip terakhir lebih tua dari 24 jam; prune uptime sekali sehari.
async fn harian(st: &Arc<AppState>) -> anyhow::Result<()> {
    let basi = services::backup::backup_service::latest_age_hours(st);
    if basi.map(|jam| jam >= 24.0).unwrap_or(true) {
        services::backup::backup_service::create(st, false).await?;
    }
    let tz = services::settings::settings_service::active_timezone(st).await;
    let batas = (crate::utils::time::today_local(&tz) - chrono::Duration::days(366))
        .format("%Y-%m-%d")
        .to_string();
    let _guard = st.write().await;
    crate::repositories::uptime::prune(&st.pool, &batas).await?;
    Ok(())
}
