//! Backup lokal: snapshot SQLite, zip, restore in-place.

use crate::db::migrate;
use crate::state::AppState;
use crate::utils::logger;
use anyhow::{anyhow, Context, Result};
use serde_json::{json, Value};
use sqlx::SqlitePool;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

pub const MANUAL_PREFIX: &str = "manual_backup_";
const CORE_TABLES: [&str; 4] = ["grup", "pc", "sesi", "transaksi"];

#[derive(Clone, Default)]
pub struct ManualStatus {
    pub running: bool,
    pub status: String,
    pub filename: Option<String>,
    pub message: String,
}

impl ManualStatus {
    pub fn json(&self) -> Value {
        json!({
            "status": if self.status.is_empty() { "idle" } else { self.status.as_str() },
            "filename": self.filename,
            "message": self.message,
        })
    }
}

pub fn dir(st: &AppState) -> PathBuf {
    let d = st.cfg.backup_dir.clone();
    let _ = fs::create_dir_all(&d);
    d
}

pub async fn snapshot(pool: &SqlitePool, dest: &Path) -> Result<()> {
    let _ = fs::remove_file(dest);
    let path = dest.to_string_lossy().replace('\'', "''");
    sqlx::query(&format!("VACUUM INTO '{path}'"))
        .execute(pool)
        .await
        .context("snapshot database gagal")?;
    Ok(())
}

pub fn zip_db(src: &Path, dest: &Path) -> Result<()> {
    let mut buf = Vec::new();
    {
        let mut zip = zip::ZipWriter::new(std::io::Cursor::new(&mut buf));
        let opt: zip::write::SimpleFileOptions = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);
        zip.start_file("warnet.db", opt)?;
        zip.write_all(&fs::read(src)?)?;
        zip.finish()?;
    }
    fs::write(dest, buf)?;
    Ok(())
}

pub fn unzip_db(archive: &Path, out: &Path) -> Result<()> {
    let file = fs::File::open(archive)?;
    let mut zip = zip::ZipArchive::new(file)?;
    let name = (0..zip.len())
        .filter_map(|i| zip.by_index(i).ok().map(|f| f.name().to_string()))
        .find(|n| n.ends_with(".db"))
        .ok_or_else(|| anyhow!("Arsip tidak berisi database TMBilling"))?;
    let mut entry = zip.by_name(&name)?;
    let mut buf = Vec::new();
    entry.read_to_end(&mut buf)?;
    fs::write(out, buf)?;
    Ok(())
}

/// Tolak arsip SQLite valid tapi bukan database TMBilling.
pub async fn inspect_schema(path: &Path) -> Result<()> {
    let pool = SqlitePool::connect(&format!("sqlite://{}", path.to_string_lossy()))
        .await
        .context("arsip bukan database SQLite")?;
    let mut found = 0;
    for t in CORE_TABLES {
        let row: Option<(i64,)> =
            sqlx::query_as("SELECT 1 FROM sqlite_master WHERE type=? AND name=?")
                .bind("table")
                .bind(t)
                .fetch_optional(&pool)
                .await?;
        if row.is_some() {
            found += 1;
        }
    }
    pool.close().await;
    if found < CORE_TABLES.len() {
        return Err(anyhow!("Arsip bukan database TMBilling yang valid"));
    }
    Ok(())
}

async fn columns(
    conn: &mut sqlx::SqliteConnection,
    schema: &str,
    table: &str,
) -> Result<Vec<String>> {
    let rows: Vec<(String,)> = sqlx::query_as(&format!(
        "SELECT name FROM pragma_table_info('{table}', '{schema}')"
    ))
    .fetch_all(&mut *conn)
    .await?;
    Ok(rows.into_iter().map(|r| r.0).collect())
}

async fn tables(conn: &mut sqlx::SqliteConnection, schema: &str) -> Result<Vec<String>> {
    let rows: Vec<(String,)> = sqlx::query_as(&format!(
        "SELECT name FROM {schema}.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'alembic_version'"
    ))
    .fetch_all(&mut *conn)
    .await?;
    Ok(rows.into_iter().map(|r| r.0).collect())
}

/// Restore langsung ke DB aktif: salin seluruh isi tabel dalam satu transaksi.
/// Dijalankan di thread blocking dengan runtime sendiri agar handler tetap `Send`.
pub async fn restore_live(st: &AppState, archive: &Path) -> Result<Value> {
    let pool = st.pool.clone();
    let root = st.cfg.root.clone();
    let backup = st.cfg.backup_dir.clone();
    let arsip = archive.to_path_buf();
    tokio::task::spawn_blocking(move || {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()?;
        rt.block_on(restore_inner(&pool, &root, &backup, &arsip))
    })
    .await
    .map_err(|e| anyhow!("restore gagal dijalankan: {e}"))?
}

async fn restore_inner(
    pool: &SqlitePool,
    root: &Path,
    backup: &Path,
    archive: &Path,
) -> Result<Value> {
    let unpacked = root.join("instance").join("restore_tmp.db");
    let arsip = archive.to_path_buf();
    let tujuan = unpacked.clone();
    tokio::task::spawn_blocking(move || unzip_db(&arsip, &tujuan))
        .await
        .map_err(|e| anyhow!("gagal membaca arsip: {e}"))??;
    if let Err(e) = inspect_schema(&unpacked).await {
        let _ = fs::remove_file(&unpacked);
        return Err(e);
    }
    let safety = backup.join(format!(
        "pre_restore_{}.db",
        chrono::Local::now().format("%Y%m%d_%H%M%S")
    ));
    snapshot(pool, &safety).await?;
    let hasil = salin_tabel(pool, &unpacked).await;
    let _ = fs::remove_file(&unpacked);
    hasil?;
    migrate::ensure_schema(pool, &root.join("instance").join("warnet.db"), backup).await?;
    logger::rec(
        "admin",
        "RESTORE_DATABASE",
        &format!("Restore dari {}", archive.display()),
    );
    Ok(json!({
        "message": "Database berhasil dipulihkan",
        "safety_backup": safety.file_name().map(|n| n.to_string_lossy().to_string()),
    }))
}

pub async fn salin_tabel(pool: &SqlitePool, unpacked: &Path) -> Result<()> {
    let mut conn = pool.acquire().await?;
    let attach = unpacked.to_string_lossy().replace('\'', "''");
    sqlx::query(&format!("ATTACH DATABASE '{attach}' AS r"))
        .execute(&mut *conn)
        .await?;
    sqlx::raw_sql("BEGIN IMMEDIATE").execute(&mut *conn).await?;
    let daftar = tables(&mut conn, "r").await?;
    for table in daftar {
        let main_cols = columns(&mut conn, "main", &table).await?;
        let restore_cols = columns(&mut conn, "r", &table).await?;
        let shared: Vec<String> = main_cols
            .into_iter()
            .filter(|c| restore_cols.iter().any(|r| r == c))
            .collect();
        if shared.is_empty() {
            continue;
        }
        let list = shared
            .iter()
            .map(|c| format!("\"{c}\""))
            .collect::<Vec<_>>()
            .join(",");
        sqlx::raw_sql(&format!("DELETE FROM main.\"{table}\""))
            .execute(&mut *conn)
            .await?;
        sqlx::raw_sql(&format!(
            "INSERT INTO main.\"{table}\" ({list}) SELECT {list} FROM r.\"{table}\""
        ))
        .execute(&mut *conn)
        .await?;
    }
    sqlx::raw_sql("COMMIT").execute(&mut *conn).await?;
    let _ = sqlx::raw_sql("DETACH DATABASE r").execute(&mut *conn).await;
    Ok(())
}

pub fn status(st: &AppState) -> Value {
    let guard = st.backup_status.lock().unwrap_or_else(|e| e.into_inner());
    guard.json()
}

/// Jalankan backup manual di background; 409 bila masih berjalan.
pub fn start_manual(st: std::sync::Arc<AppState>) -> Result<Value, (u16, String)> {
    {
        let mut guard = st.backup_status.lock().unwrap_or_else(|e| e.into_inner());
        if guard.running {
            return Err((409, "Backup manual sedang berjalan.".into()));
        }
        guard.running = true;
        guard.status = "running".into();
        guard.filename = None;
        guard.message = "Backup sedang berjalan".into();
    }
    let st_task = st.clone();
    tokio::spawn(async move {
        let hasil = create(&st_task, true).await;
        let mut guard = st_task
            .backup_status
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        guard.running = false;
        match hasil {
            Ok(name) => {
                guard.status = "succeeded".into();
                guard.message = format!("Backup berhasil: {name}");
                guard.filename = Some(name);
            }
            Err(e) => {
                guard.status = "failed".into();
                guard.message = format!("Backup gagal: {e}");
            }
        }
    });
    Ok(json!({"status": "running", "filename": null, "message": "Backup sedang berjalan"}))
}

pub fn list(st: &AppState) -> Vec<Value> {
    let mut out = Vec::new();
    if let Ok(rd) = fs::read_dir(dir(st)) {
        for e in rd.flatten() {
            let _path = e.path();
            let name = e.file_name().to_string_lossy().to_string();
            if !name.ends_with(".zip") {
                continue;
            }
            let meta = e.metadata().ok();
            let modified = meta.as_ref().and_then(|m| m.modified().ok()).map(|t| {
                chrono::DateTime::<chrono::Local>::from(t)
                    .format("%Y-%m-%d %H:%M:%S")
                    .to_string()
            });
            let ukuran = meta.as_ref().map(|m| m.len()).unwrap_or(0);
            out.push(json!({
                "filename": name,
                "size": ukuran,
                "size_mb": format!("{:.2}", ukuran as f64 / 1_048_576.0),
                "created_at": modified,
                "is_manual": name.starts_with(MANUAL_PREFIX),
            }));
        }
    }
    out.sort_by(|a, b| b["filename"].as_str().cmp(&a["filename"].as_str()));
    out
}

/// Buat backup manual (`manual_backup_<ts>.zip`) dan kembalikan nama berkas.
pub async fn create(st: &AppState, manual: bool) -> Result<String> {
    let prefix = if manual { MANUAL_PREFIX } else { "backup_" };
    let name = format!(
        "{prefix}{}.zip",
        chrono::Local::now().format("%Y%m%d_%H%M%S")
    );
    let dest = dir(st).join(&name);
    let tmp = st.cfg.root.join("instance").join("backup_tmp.db");
    snapshot(&st.pool, &tmp).await?;
    zip_db(&tmp, &dest)?;
    let _ = fs::remove_file(&tmp);
    logger::rec("SYSTEM", "DATABASE_BACKUP", &format!("File: {name}"));
    let (unggah, gagal) = super::cloud::upload(st, &dest).await;
    for nama in &unggah {
        logger::rec(
            "SYSTEM",
            "BACKUP_CLOUD_SUCCESS",
            &format!("Berhasil mengunggah ke {nama}"),
        );
    }
    for nama in &gagal {
        logger::rec(
            "SYSTEM",
            "BACKUP_CLOUD_FAILED",
            &format!("Gagal mengunggah ke {nama}"),
        );
    }
    Ok(name)
}

/// Nama provider mengikuti Python: Discord Webhook / WebDAV / Google Drive / NAS.
/// Usia arsip backup non-manual terbaru (jam); `None` bila belum ada.
pub fn latest_age_hours(st: &AppState) -> Option<f64> {
    let dir = dir(st);
    let mut terbaru: Option<std::time::SystemTime> = None;
    for entry in std::fs::read_dir(&dir).ok()?.flatten() {
        let nama = entry.file_name().to_string_lossy().to_string();
        if !nama.ends_with(".zip") || nama.starts_with(MANUAL_PREFIX) {
            continue;
        }
        if let Ok(meta) = entry.metadata() {
            if let Ok(waktu) = meta.modified() {
                terbaru = Some(terbaru.map_or(waktu, |t| t.max(waktu)));
            }
        }
    }
    terbaru.map(|t| {
        std::time::SystemTime::now()
            .duration_since(t)
            .map(|d| d.as_secs_f64() / 3600.0)
            .unwrap_or(0.0)
    })
}

pub fn provider_name(kind: &str) -> Option<&'static str> {
    match kind {
        "webhook" => Some("Discord Webhook"),
        "webdav" => Some("WebDAV"),
        "gdrive" => Some("Google Drive"),
        "nas" => Some("NAS"),
        _ => None,
    }
}

pub fn reachable(target: &str) -> bool {
    let t = target
        .trim()
        .trim_start_matches("https://")
        .trim_start_matches("http://");
    let host_port = t.split('/').next().unwrap_or(t);
    let addr = if host_port.contains(':') {
        host_port.to_string()
    } else {
        format!("{host_port}:443")
    };
    use std::net::ToSocketAddrs;
    match addr.to_socket_addrs() {
        Ok(mut it) => match it.next() {
            Some(sa) => {
                std::net::TcpStream::connect_timeout(&sa, std::time::Duration::from_secs(5)).is_ok()
            }
            None => false,
        },
        Err(_) => false,
    }
}
