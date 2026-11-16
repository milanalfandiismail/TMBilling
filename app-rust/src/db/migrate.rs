//! Migrasi skema setara Alembic Python.
//!
//! Rantai 26 revisi Alembic tidak bisa diputar dari database kosong (revisi 1
//! hanya `ALTER TABLE hardware_monitor`, banyak tabel lahir lewat
//! `db.create_all()`), jadi port ini mengikuti perilaku produksi Python:
//! database kosong dibangun dari skema head kanonik, database lama hanya
//! ditambah tabel/kolom/index yang belum ada lalu di-stamp ke head.
//! Tidak ada tabel atau kolom yang dihapus.

use anyhow::{Context, Result};
use serde::Deserialize;
use sqlx::SqlitePool;
use std::path::{Path, PathBuf};

pub const HEAD_REVISION: &str = "a2b3c4d5e6f7";
const HEAD_SQL: &str = include_str!("../../migrations/0001_schema_head.sql");
const HEAD_JSON: &str = include_str!("../../migrations/0001_schema.json");

#[derive(Deserialize)]
struct Column {
    name: String,
    #[serde(rename = "type")]
    ty: String,
    default: Option<String>,
}

#[derive(Deserialize)]
struct Table {
    name: String,
    create_sql: String,
    columns: Vec<Column>,
}

#[derive(Deserialize)]
struct Index {
    name: String,
    sql: String,
}

#[derive(Deserialize)]
struct Head {
    tables: Vec<Table>,
    indexes: Vec<Index>,
}

/// Ringkasan pekerjaan migrasi yang dilakukan sekali jalan saat startup.
#[derive(Debug, Default)]
pub struct Report {
    pub fresh: bool,
    pub created_tables: usize,
    pub added_columns: usize,
    pub created_indexes: usize,
    pub snapshot: Option<PathBuf>,
}

impl Report {
    pub fn changed(&self) -> bool {
        self.fresh || self.created_tables + self.added_columns + self.created_indexes > 0
    }
}

/// Daftar tabel head (nama + kolom) untuk audit/test paritas.
pub struct HeadSpec {
    pub tables: Vec<(String, Vec<String>)>,
    pub indexes: Vec<String>,
}

pub fn head_spec() -> Result<HeadSpec> {
    let head: Head = serde_json::from_str(HEAD_JSON)?;
    Ok(HeadSpec {
        tables: head
            .tables
            .into_iter()
            .map(|t| (t.name, t.columns.into_iter().map(|c| c.name).collect()))
            .collect(),
        indexes: head.indexes.into_iter().map(|i| i.name).collect(),
    })
}

/// Pastikan database berada di skema head. DB lama di-snapshot dulu bila ada
/// perubahan yang perlu ditulis.
pub async fn ensure_schema(pool: &SqlitePool, db_path: &Path, backup_dir: &Path) -> Result<Report> {
    let head: Head = serde_json::from_str(HEAD_JSON).context("skema head JSON rusak")?;
    let existing = table_names(pool).await?;
    let mut report = Report::default();

    if existing.is_empty() {
        exec_script(pool, HEAD_SQL)
            .await
            .context("membuat skema head awal")?;
        stamp(pool).await?;
        report.fresh = true;
        report.created_tables = head.tables.len();
        report.created_indexes = head.indexes.len();
        return Ok(report);
    }

    // Hitung dulu, baru snapshot: startup tanpa perubahan tidak menulis apa pun.
    let mut missing_tables = Vec::new();
    let mut missing_columns = Vec::new();
    for table in &head.tables {
        if !existing.iter().any(|n| n == &table.name) {
            missing_tables.push(table);
            continue;
        }
        let present = column_names(pool, &table.name).await?;
        for col in &table.columns {
            if !present.iter().any(|n| n == &col.name) {
                missing_columns.push((&table.name, col));
            }
        }
    }
    let present_indexes = index_names(pool).await?;
    let missing_indexes: Vec<&Index> = head
        .indexes
        .iter()
        .filter(|i| !present_indexes.iter().any(|n| n == &i.name))
        .collect();

    if missing_tables.is_empty() && missing_columns.is_empty() && missing_indexes.is_empty() {
        stamp(pool).await?;
        return Ok(report);
    }

    if db_path.exists() {
        report.snapshot = Some(snapshot(pool, db_path, backup_dir).await?);
    }

    for table in &missing_tables {
        exec_script(pool, &table.create_sql)
            .await
            .with_context(|| format!("membuat tabel {}", table.name))?;
        report.created_tables += 1;
    }
    for (table, col) in &missing_columns {
        let mut ddl = format!(
            "ALTER TABLE \"{table}\" ADD COLUMN \"{}\" {}",
            col.name, col.ty
        );
        if let Some(default) = &col.default {
            ddl.push_str(&format!(" DEFAULT {default}"));
        }
        sqlx::query(&ddl)
            .execute(pool)
            .await
            .with_context(|| format!("menambah kolom {table}.{}", col.name))?;
        report.added_columns += 1;
    }
    for index in &missing_indexes {
        exec_script(pool, &index.sql)
            .await
            .with_context(|| format!("membuat index {}", index.name))?;
        report.created_indexes += 1;
    }
    stamp(pool).await?;
    Ok(report)
}

async fn table_names(pool: &SqlitePool) -> Result<Vec<String>> {
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT name FROM sqlite_master WHERE type='table' \
         AND name NOT LIKE 'sqlite_%' AND name <> 'alembic_version'",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(|r| r.0).collect())
}

async fn column_names(pool: &SqlitePool, table: &str) -> Result<Vec<String>> {
    let rows: Vec<(i64, String)> = sqlx::query_as(&format!("PRAGMA table_info(\"{table}\")"))
        .fetch_all(pool)
        .await?;
    Ok(rows.into_iter().map(|r| r.1).collect())
}

async fn index_names(pool: &SqlitePool) -> Result<Vec<String>> {
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(|r| r.0).collect())
}

/// Snapshot Online Backup API: `VACUUM INTO` menyalin isi termasuk `-wal`.
async fn snapshot(pool: &SqlitePool, db_path: &Path, backup_dir: &Path) -> Result<PathBuf> {
    std::fs::create_dir_all(backup_dir)?;
    let stamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let dest = backup_dir.join(format!("pre-rust-{stamp}.db"));
    if dest.exists() {
        std::fs::remove_file(&dest)?;
    }
    let escaped = dest.display().to_string().replace('\'', "''");
    sqlx::query(&format!("VACUUM INTO '{escaped}'"))
        .execute(pool)
        .await
        .with_context(|| format!("snapshot database ke {}", dest.display()))?;
    let src_len = std::fs::metadata(db_path).map(|m| m.len()).unwrap_or(0);
    let dest_len = std::fs::metadata(&dest).map(|m| m.len()).unwrap_or(0);
    anyhow::ensure!(
        dest_len > 0 && dest_len >= src_len / 2,
        "snapshot database tidak lengkap"
    );
    Ok(dest)
}

async fn stamp(pool: &SqlitePool) -> Result<()> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS alembic_version (\
         version_num VARCHAR(32) NOT NULL, \
         CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num))",
    )
    .execute(pool)
    .await?;
    sqlx::query("DELETE FROM alembic_version")
        .execute(pool)
        .await?;
    sqlx::query("INSERT INTO alembic_version (version_num) VALUES (?)")
        .bind(HEAD_REVISION)
        .execute(pool)
        .await?;
    Ok(())
}

async fn exec_script(pool: &SqlitePool, script: &str) -> Result<()> {
    for stmt in script.split(';') {
        let stmt = stmt.trim();
        if stmt.is_empty() {
            continue;
        }
        sqlx::query(stmt).execute(pool).await?;
    }
    Ok(())
}
