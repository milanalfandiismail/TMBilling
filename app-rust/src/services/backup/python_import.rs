//! Impor database Python 1.6.5: staging unggahan, pratinjau selisih skema, dan penimpaan aman.
use crate::db::migrate;
use crate::services::backup::backup_service;
use crate::state::AppState;
use crate::utils::logger;
use anyhow::{anyhow, Context, Result};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::fs;
use std::io::{Cursor, Read};
use std::path::{Path, PathBuf};

pub struct Staged {
    pub path: PathBuf,
    pub token: String,
}

fn staging_root(st: &AppState) -> PathBuf {
    st.cfg.root.join("instance").join("import_staging")
}

pub fn token_path(st: &AppState, token: &str) -> Option<PathBuf> {
    if token.len() != 64 || !token.chars().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }
    let path = staging_root(st).join(token).join("upload.db");
    path.exists().then_some(path)
}

/// Simpan unggahan `.db` atau ZIP (mengambil `warnet.db` + `warnet.db-wal`).
pub fn stage(st: &AppState, bytes: &[u8]) -> Result<Staged> {
    if bytes.len() > 512 * 1024 * 1024 {
        return Err(anyhow!("Berkas terlalu besar (maks 512 MB)"));
    }
    let token = hex::encode(Sha256::digest(bytes));
    let dir = staging_root(st).join(&token);
    fs::create_dir_all(&dir)?;
    let path = dir.join("upload.db");
    if bytes.starts_with(b"PK\x03\x04") {
        let mut zip = zip::ZipArchive::new(Cursor::new(bytes)).context("Arsip ZIP rusak")?;
        let (mut db, mut ada_wal) = (false, false);
        for i in 0..zip.len() {
            let mut entry = zip.by_index(i)?;
            // Nama tujuan ditentukan di sini, bukan dari entri, sehingga path traversal tidak mungkin.
            let tujuan = if entry.name().ends_with(".db-wal") {
                ada_wal = true;
                dir.join("upload.db-wal")
            } else if entry.name().ends_with(".db") {
                db = true;
                dir.join("upload.db")
            } else {
                continue;
            };
            let mut buf = Vec::new();
            entry.read_to_end(&mut buf)?;
            fs::write(tujuan, buf)?;
        }
        let _ = ada_wal;
        if !db {
            return Err(anyhow!("Arsip tidak berisi berkas .db"));
        }
    } else {
        fs::write(&path, bytes)?;
    }
    Ok(Staged { path, token })
}

async fn buka(path: &Path) -> Result<SqlitePool> {
    let opts = SqliteConnectOptions::new()
        .filename(path)
        .read_only(true);
    SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(opts)
        .await
        .context("berkas bukan database SQLite yang valid")
}

async fn daftar_tabel(pool: &SqlitePool) -> Result<Vec<String>> {
    Ok(sqlx::query_scalar(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'alembic_version'",
    )
    .fetch_all(pool)
    .await?)
}

async fn hitung_baris(pool: &SqlitePool, tabel: &[String]) -> Result<i64> {
    let mut total = 0;
    for t in ["member", "pc", "sesi", "transaksi", "user", "grup", "paket"] {
        if !tabel.iter().any(|n| n == t) {
            continue;
        }
        let n: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM \"{t}\""))
            .fetch_one(pool)
            .await?;
        total += n;
    }
    Ok(total)
}

async fn duplikat(pool: &SqlitePool, kolom: &str) -> Result<i64> {
    Ok(sqlx::query_scalar(&format!(
        "SELECT COUNT(*) FROM (SELECT {kolom} FROM sesi WHERE status='aktif' AND {kolom} IS NOT NULL GROUP BY {kolom} HAVING COUNT(*)>1)"
    ))
    .fetch_one(pool)
    .await?)
}

pub async fn inspect(path: &Path) -> Result<Value> {
    let pool = buka(path).await?;
    let tabel = daftar_tabel(&pool).await?;
    let head = migrate::head_spec()?;
    let (mut missing_tables, mut missing_columns) = (Vec::new(), Vec::new());
    for (nama, kolom) in &head.tables {
        if !tabel.iter().any(|t| t == nama) {
            missing_tables.push(nama.clone());
            continue;
        }
        let ada: Vec<String> =
            sqlx::query_scalar(&format!("SELECT name FROM pragma_table_info('{nama}')"))
                .fetch_all(&pool)
                .await?;
        for c in kolom {
            if !ada.iter().any(|a| a == c) {
                missing_columns.push(format!("{nama}.{c}"));
            }
        }
    }
    let index: Vec<String> = sqlx::query_scalar(
        "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'",
    )
    .fetch_all(&pool)
    .await?;
    let missing_indexes: Vec<String> = head
        .indexes
        .into_iter()
        .filter(|i| !index.iter().any(|n| n == i))
        .collect();
    let ada_alembic: Option<String> = sqlx::query_scalar(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='alembic_version'",
    )
    .fetch_optional(&pool)
    .await?;
    let python_revision: Option<String> = if ada_alembic.is_some() {
        sqlx::query_scalar("SELECT version_num FROM alembic_version LIMIT 1")
            .fetch_optional(&pool)
            .await?
    } else {
        None
    };
    let rows = hitung_baris(&pool, &tabel).await?;
    let (dup_pc, dup_member) = if tabel.iter().any(|t| t == "sesi") {
        (
            duplikat(&pool, "pc_id").await?,
            duplikat(&pool, "member_id").await?,
        )
    } else {
        (0, 0)
    };
    let ukuran = fs::metadata(path).map(|m| m.len()).unwrap_or(0);
    pool.close().await;
    Ok(json!({
        "tables": tabel.len(),
        "missing_tables": missing_tables,
        "missing_columns": missing_columns,
        "missing_indexes": missing_indexes,
        "python_revision": python_revision,
        "size_bytes": ukuran,
        "rows": rows,
        "duplikat_sesi_pc": dup_pc,
        "duplikat_sesi_member": dup_member,
    }))
}

/// Timpa database aktif dengan isi berkas staging. Snapshot dibuat sebelum menyentuh apa pun.
pub async fn apply(st: &AppState, token: &str) -> Result<Value> {
    let path = token_path(st, token).ok_or_else(|| anyhow!("Token migrasi tidak valid"))?;
    let _g = st.write().await;
    backup_service::inspect_schema(&path).await?;
    let nama_safety = format!(
        "pre_import_{}.db",
        chrono::Local::now().format("%Y%m%d_%H%M%S")
    );
    let safety = backup_service::dir(st).join(&nama_safety);

    // Salin tabel berjalan di thread blocking dengan runtime sendiri, pola yang sama
    // dengan restore_live, agar future handler tetap Send.
    let pool = st.pool.clone();
    let db_path = st.cfg.db_path.clone();
    let backup_dir = st.cfg.backup_dir.clone();
    let sumber = path.clone();
    let (tables_imported, rows_imported) = tokio::task::spawn_blocking(move || {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()?;
        rt.block_on(async move {
            backup_service::snapshot(&pool, &safety).await?;
            let src = buka(&sumber).await?;
            let tabel = daftar_tabel(&src).await?;
            let rows = hitung_baris(&src, &tabel).await?;
            src.close().await;
            backup_service::salin_tabel(&pool, &sumber).await?;
            migrate::ensure_schema(&pool, &db_path, &backup_dir).await?;
            Ok::<_, anyhow::Error>((tabel.len(), rows))
        })
    })
    .await
    .map_err(|e| anyhow!("impor gagal dijalankan: {e}"))??;

    st.settings.invalidate();
    st.pc_network.invalidate();
    crate::services::settings::ip_whitelist::seed_defaults(st).await?;
    crate::services::auth::bootstrap::ensure_initial_admin(st).await?;
    let _ = crate::services::tutorial::tutorial_service::seed(st).await;
    logger::rec(
        "admin",
        "MIGRASI_DATABASE",
        &format!("Impor database dari token {token} ({rows_imported} baris)"),
    );
    if let Some(dir) = path.parent() {
        let _ = fs::remove_dir_all(dir);
    }
    Ok(json!({
        "message": "Migrasi database selesai",
        "tables_imported": tables_imported,
        "rows_imported": rows_imported,
        "safety_backup": nama_safety,
        "alembic": migrate::HEAD_REVISION,
    }))
}
