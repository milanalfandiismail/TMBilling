//! Paritas skema: DB kosong dan DB lama harus berakhir di skema head.

use sqlx::SqlitePool;
use std::path::{Path, PathBuf};
use tmbilling_server::db::{migrate, open};

struct TempDir(PathBuf);

impl TempDir {
    fn new(tag: &str) -> Self {
        let mut path = std::env::temp_dir();
        path.push(format!(
            "tm_schema_{tag}_{}_{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&path).unwrap();
        Self(path)
    }
    fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

async fn columns(pool: &SqlitePool, table: &str) -> Vec<String> {
    let rows: Vec<(i64, String)> = sqlx::query_as(&format!("PRAGMA table_info(\"{table}\")"))
        .fetch_all(pool)
        .await
        .unwrap();
    rows.into_iter().map(|r| r.1).collect()
}

async fn tables(pool: &SqlitePool) -> Vec<String> {
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> 'alembic_version'",
    )
    .fetch_all(pool)
    .await
    .unwrap();
    rows.into_iter().map(|r| r.0).collect()
}

async fn assert_matches_head(pool: &SqlitePool) {
    let spec = migrate::head_spec().unwrap();
    let present = tables(pool).await;
    for (table, cols) in &spec.tables {
        assert!(present.iter().any(|n| n == table), "tabel {table} hilang");
        let actual = columns(pool, table).await;
        for col in cols {
            assert!(
                actual.iter().any(|n| n == col),
                "kolom {table}.{col} hilang"
            );
        }
    }
    let (version,): (String,) = sqlx::query_as("SELECT version_num FROM alembic_version")
        .fetch_one(pool)
        .await
        .unwrap();
    assert_eq!(version, migrate::HEAD_REVISION);
}

#[tokio::test]
async fn fresh_database_builds_head_schema() {
    let dir = TempDir::new("fresh");
    let db_path = dir.path().join("warnet.db");
    let pool = open(&db_path).await.unwrap();
    let report = migrate::ensure_schema(&pool, &db_path, &dir.path().join("backups"))
        .await
        .unwrap();
    assert!(report.fresh);
    assert!(report.created_tables > 0);
    // skema tanpa data: hanya skema head + alembic_version
    assert!(report.snapshot.is_none());
    assert_matches_head(&pool).await;
}

#[tokio::test]
async fn legacy_database_is_upgraded_and_snapshotted() {
    let dir = TempDir::new("legacy");
    let db_path = dir.path().join("warnet.db");
    std::fs::copy("tests/fixtures/warnet_legacy.db", &db_path).unwrap();
    let pool = open(&db_path).await.unwrap();
    let before = tables(&pool).await.len();
    let report = migrate::ensure_schema(&pool, &db_path, &dir.path().join("backups"))
        .await
        .unwrap();
    assert!(!report.fresh);
    assert!(report.created_tables > 0, "tabel baru harus ditambahkan");
    assert!(report
        .snapshot
        .as_ref()
        .map(|p| p.exists())
        .unwrap_or(false));
    assert!(tables(&pool).await.len() > before);
    assert_matches_head(&pool).await;
}

#[tokio::test]
async fn second_start_changes_nothing() {
    let dir = TempDir::new("idempotent");
    let db_path = dir.path().join("warnet.db");
    let backups = dir.path().join("backups");
    let pool = open(&db_path).await.unwrap();
    migrate::ensure_schema(&pool, &db_path, &backups)
        .await
        .unwrap();
    let report = migrate::ensure_schema(&pool, &db_path, &backups)
        .await
        .unwrap();
    assert!(!report.changed());
    assert!(report.snapshot.is_none());
    assert_matches_head(&pool).await;
}
