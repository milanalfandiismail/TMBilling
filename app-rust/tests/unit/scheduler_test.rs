//! Unit: flush uptime, prune log, dan kunci single instance.

use std::sync::Arc;

use tmbilling_server::config::Config;
use tmbilling_server::state::AppState;

struct TempDir(std::path::PathBuf);

impl TempDir {
    fn new(tag: &str) -> Self {
        let mut path = std::env::temp_dir();
        path.push(format!(
            "tm_sched_{tag}_{}_{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&path).unwrap();
        Self(path)
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

async fn state(tag: &str) -> (TempDir, Arc<AppState>) {
    let dir = TempDir::new(tag);
    let cfg = Config::load(&dir.0).unwrap();
    let st = Arc::new(AppState::new(cfg).await.unwrap());
    (dir, st)
}

#[tokio::test]
async fn flush_menulis_delta_uptime_dan_prune_menghapus_log_lama() {
    let (_dir, st) = state("flush").await;
    let grup_id: i64 =
        sqlx::query_scalar("INSERT INTO grup (nama) VALUES ('reguler') RETURNING id")
            .fetch_one(&st.pool)
            .await
            .unwrap();
    let pc_id: i64 = sqlx::query_scalar(
        "INSERT INTO pc (kode, nama, aktif, grup_id) VALUES ('PC-99', 'PC Uji', 1, ?) RETURNING id",
    )
    .bind(grup_id)
    .fetch_one(&st.pool)
    .await
    .unwrap();
    st.uptime.heartbeat(pc_id, true, 1000);
    st.uptime.heartbeat(pc_id, true, 1030);
    let delta: Vec<(i64, i64, i64)> = st
        .uptime
        .drain()
        .into_iter()
        .map(|(id, acc)| (id, acc.online, acc.billing))
        .collect();
    assert!(delta
        .iter()
        .any(|(id, online, _)| *id == pc_id && *online == 30));
    tmbilling_server::repositories::uptime::flush(&st.pool, "2026-01-02", &[(pc_id, 60, 30)])
        .await
        .unwrap();
    tmbilling_server::repositories::uptime::flush(&st.pool, "2026-01-02", &[(pc_id, 30, 30)])
        .await
        .unwrap();
    let (online, billing): (i64, i64) = sqlx::query_as(
        "SELECT total_online_seconds, total_billing_seconds FROM pc_uptime_log WHERE pc_id = ? AND tanggal = '2026-01-02'",
    )
    .bind(pc_id)
    .fetch_one(&st.pool)
    .await
    .unwrap();
    assert_eq!(
        (online, billing),
        (90, 60),
        "flush harus menambah, bukan menimpa"
    );

    sqlx::query("INSERT INTO pc_uptime_log (pc_id, tanggal, total_online_seconds, total_billing_seconds) VALUES (?, '2020-01-01', 1, 1)")
        .bind(pc_id)
        .execute(&st.pool)
        .await
        .unwrap();
    let hapus = tmbilling_server::repositories::uptime::prune(&st.pool, "2026-01-01")
        .await
        .unwrap();
    assert_eq!(hapus, 1);
}

#[tokio::test]
async fn instance_kedua_ditolak() {
    let dir = TempDir::new("lock");
    let kunci = tmbilling_server::utils::instance::acquire(&dir.0).unwrap();
    assert!(tmbilling_server::utils::instance::acquire(&dir.0).is_err());
    drop(kunci);
    assert!(tmbilling_server::utils::instance::acquire(&dir.0).is_ok());
}
