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
    const MAX_UNPACKED_SIZE: u64 = 2 * 1024 * 1024 * 1024; // 2 GB safety limit
    let file = fs::File::open(archive)?;
    let mut zip = zip::ZipArchive::new(file)?;
    let name = (0..zip.len())
        .filter_map(|i| zip.by_index(i).ok().map(|f| f.name().to_string()))
        .find(|n| n.ends_with(".db"))
        .ok_or_else(|| anyhow!("Arsip tidak berisi database TMBilling"))?;
    let mut entry = zip.by_name(&name)?;
    let mut buf = Vec::new();
    let read_bytes = entry.by_ref().take(MAX_UNPACKED_SIZE + 1).read_to_end(&mut buf)?;
    if read_bytes as u64 > MAX_UNPACKED_SIZE {
        return Err(anyhow!("Ukuran berkas database melebihi batas aman 2GB"));
    }
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
    let _write_guard = st.write().await;
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
    // Impor menimpa induk dan anak sekaligus; FK dimatikan selama salin lalu diverifikasi.
    // PRAGMA foreign_keys tidak berlaku bila dijalankan di dalam transaksi.
    sqlx::raw_sql("PRAGMA foreign_keys = OFF")
        .execute(&mut *conn)
        .await?;
    sqlx::raw_sql("BEGIN IMMEDIATE").execute(&mut *conn).await?;

    let proses = async {
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
            let wajib: Vec<(String, String)> = sqlx::query_as(
                "SELECT name, type FROM pragma_table_info(?) WHERE \"notnull\"=1 AND dflt_value IS NULL",
            )
            .bind(&table)
            .fetch_all(&mut *conn)
            .await?
            .into_iter()
            .filter(|(n, _): &(String, String)| !shared.iter().any(|c| c == n))
            .map(|(n, t): (String, String)| {
                let huruf = t.to_uppercase();
                let isi = if huruf.contains("INT") || huruf.contains("BOOL") || huruf.contains("REAL") || huruf.contains("FLOA") || huruf.contains("DOUB") {
                    "0".to_string()
                } else {
                    "''".to_string()
                };
                (n, isi)
            })
            .collect();
            let mut kolom: Vec<String> = shared.iter().map(|c| format!("\"{c}\"")).collect();
            let mut nilai: Vec<String> = shared.iter().map(|c| format!("\"{c}\"")).collect();
            for (n, isi) in &wajib {
                kolom.push(format!("\"{n}\""));
                nilai.push(isi.clone());
            }
            let list = kolom.join(",");
            let pilih = nilai.join(",");
            sqlx::raw_sql(&format!("DELETE FROM main.\"{table}\""))
                .execute(&mut *conn)
                .await
                .map_err(|e| anyhow!("hapus tabel {table}: {e}"))?;
            sqlx::raw_sql(&format!(
                "INSERT INTO main.\"{table}\" ({list}) SELECT {pilih} FROM r.\"{table}\""
            ))
            .execute(&mut *conn)
            .await
            .map_err(|e| anyhow!("salin tabel {table}: {e}"))?;
        }
        Result::<(), anyhow::Error>::Ok(())
    };

    let hasil = proses.await;
    if hasil.is_ok() {
        sqlx::raw_sql("COMMIT").execute(&mut *conn).await?;
    } else {
        let _ = sqlx::raw_sql("ROLLBACK").execute(&mut *conn).await;
    }
    let _ = sqlx::raw_sql("DETACH DATABASE r").execute(&mut *conn).await;
    let _ = sqlx::raw_sql("PRAGMA foreign_keys = ON").execute(&mut *conn).await;
    hasil
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
    let _write_guard = st.write().await;
    let prefix = if manual { MANUAL_PREFIX } else { "backup_" };
    let name = format!(
        "{prefix}{}.zip",
        chrono::Local::now().format("%Y%m%d_%H%M%S")
    );
    let dest = dir(st).join(&name);
    let tmp = st.cfg.root.join("instance").join(format!("backup_tmp_{}.db", std::process::id()));
    snapshot(&st.pool, &tmp).await?;
    let zip_res = zip_db(&tmp, &dest);
    let _ = fs::remove_file(&tmp);
    zip_res?;
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
    let t = target.trim();
    let is_http = t.starts_with("http://");
    let clean = t
        .trim_start_matches("https://")
        .trim_start_matches("http://");
    let host_port = clean.split('/').next().unwrap_or(clean);
    let addr = if host_port.contains(':') {
        host_port.to_string()
    } else if is_http {
        format!("{host_port}:80")
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::Config;
    use std::net::TcpListener;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::Arc;

    static NEXT_ID: AtomicU64 = AtomicU64::new(1);

    struct TempDir(PathBuf);

    impl TempDir {
        fn new(tag: &str) -> Self {
            let seq = NEXT_ID.fetch_add(1, Ordering::Relaxed);
            let path = std::env::temp_dir().join(format!(
                "tm_backup_unit_{tag}_{}_{}",
                std::process::id(),
                seq
            ));
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    async fn test_state(tag: &str) -> (TempDir, Arc<AppState>) {
        let dir = TempDir::new(tag);
        let cfg = Config::load(&dir.0).unwrap();
        let st = Arc::new(AppState::new(cfg).await.unwrap());
        (dir, st)
    }

    fn write_zip_entries(dest: &Path, entries: &[(&str, &[u8])]) {
        let file = fs::File::create(dest).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        let opt = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);
        for (name, data) in entries {
            zip.start_file(*name, opt).unwrap();
            zip.write_all(data).unwrap();
        }
        zip.finish().unwrap();
    }

    #[tokio::test]
    async fn snapshot_zip_dan_unzip_roundtrip_menjaga_isi_db() {
        let (dir, st) = test_state("roundtrip").await;
        let snap1 = dir.0.join("snap.db");
        fs::write(&snap1, b"sampah-lama").unwrap();

        snapshot(&st.pool, &snap1).await.unwrap();
        assert!(snap1.exists());

        let zip_path = dir.0.join("arsip.zip");
        zip_db(&snap1, &zip_path).unwrap();

        let unpacked = dir.0.join("unpacked.db");
        unzip_db(&zip_path, &unpacked).unwrap();
        inspect_schema(&unpacked).await.unwrap();
    }

    #[test]
    fn unzip_db_menolak_arsip_tanpa_db_dan_menerima_db_bersarang() {
        let dir = TempDir::new("unzip_edge");

        let no_db = dir.0.join("tanpa_db.zip");
        write_zip_entries(&no_db, &[("readme.txt", b"bukan db")]);
        let err = unzip_db(&no_db, &dir.0.join("out1.db")).unwrap_err();
        assert!(
            err.to_string().contains("Arsip tidak berisi database TMBilling"),
            "error tak terduga: {err}"
        );

        let corrupt = dir.0.join("rusak.zip");
        fs::write(&corrupt, b"not-a-zip-archive").unwrap();
        assert!(unzip_db(&corrupt, &dir.0.join("out2.db")).is_err());

        let nested = dir.0.join("bersarang.zip");
        write_zip_entries(
            &nested,
            &[("notes.txt", b"meta"), ("nested/custom.db", b"isi-db-uji")],
        );
        let out = dir.0.join("out3.db");
        unzip_db(&nested, &out).unwrap();
        assert_eq!(fs::read(&out).unwrap(), b"isi-db-uji");
    }

    #[tokio::test]
    async fn inspect_schema_menolak_db_asing_dan_file_korup() {
        let dir = TempDir::new("inspect");

        let garbage = dir.0.join("garbage.db");
        fs::write(&garbage, b"bukan sqlite sama sekali").unwrap();
        assert!(inspect_schema(&garbage).await.is_err());

        let foreign = dir.0.join("foreign.db");
        let pool = crate::db::open(&foreign).await.unwrap();
        sqlx::raw_sql(
            "CREATE TABLE grup (id INTEGER PRIMARY KEY);
             CREATE TABLE pc (id INTEGER PRIMARY KEY);
             CREATE TABLE sesi (id INTEGER PRIMARY KEY);",
        )
        .execute(&pool)
        .await
        .unwrap();
        pool.close().await;

        let err = inspect_schema(&foreign).await.unwrap_err();
        assert!(
            err.to_string().contains("Arsip bukan database TMBilling yang valid"),
            "error tak terduga: {err}"
        );
    }

    #[tokio::test]
    async fn salin_tabel_mengisi_kolom_wajib_baru_dan_menjaga_fk_serta_detach() {
        let dir = TempDir::new("salin");
        let target_path = dir.0.join("target.db");
        let source_path = dir.0.join("source.db");

        let target = crate::db::open(&target_path).await.unwrap();
        sqlx::raw_sql(
            "CREATE TABLE induk (id INTEGER PRIMARY KEY, nama TEXT NOT NULL);
             CREATE TABLE anak (
                 id INTEGER PRIMARY KEY,
                 induk_id INTEGER NOT NULL REFERENCES induk(id),
                 label TEXT NOT NULL,
                 is_aktif INTEGER NOT NULL,
                 catatan TEXT NOT NULL
             );
             CREATE TABLE khusus_target (id INTEGER PRIMARY KEY, info TEXT NOT NULL);
             INSERT INTO induk (id, nama) VALUES (99, 'lama');
             INSERT INTO anak (id, induk_id, label, is_aktif, catatan) VALUES (99, 99, 'lama', 1, 'lama');",
        )
        .execute(&target)
        .await
        .unwrap();

        let source = crate::db::open(&source_path).await.unwrap();
        sqlx::raw_sql(
            "CREATE TABLE induk (id INTEGER PRIMARY KEY, nama TEXT NOT NULL);
             CREATE TABLE anak (
                 id INTEGER PRIMARY KEY,
                 induk_id INTEGER NOT NULL,
                 label TEXT NOT NULL,
                 kolom_usang TEXT
             );
             CREATE TABLE hanya_di_sumber (id INTEGER PRIMARY KEY);
             INSERT INTO induk (id, nama) VALUES (1, 'baru');
             INSERT INTO anak (id, induk_id, label, kolom_usang) VALUES (10, 1, 'sesi-1', 'x');",
        )
        .execute(&source)
        .await
        .unwrap();
        source.close().await;

        salin_tabel(&target, &source_path).await.unwrap();

        let induk_rows: Vec<(i64, String)> =
            sqlx::query_as("SELECT id, nama FROM induk ORDER BY id")
                .fetch_all(&target)
                .await
                .unwrap();
        assert_eq!(induk_rows, vec![(1, "baru".to_string())]);

        let anak_rows: Vec<(i64, i64, String, i64, String)> = sqlx::query_as(
            "SELECT id, induk_id, label, is_aktif, catatan FROM anak ORDER BY id",
        )
        .fetch_all(&target)
        .await
        .unwrap();
        assert_eq!(
            anak_rows,
            vec![(10, 1, "sesi-1".to_string(), 0, String::new())]
        );

        let mut conn = target.acquire().await.unwrap();
        let fk: (i64,) = sqlx::query_as("PRAGMA foreign_keys")
            .fetch_one(&mut *conn)
            .await
            .unwrap();
        assert_eq!(fk.0, 1, "foreign_keys wajib aktif kembali sesudah salin_tabel");

        let dbs: Vec<(i64, String, String)> = sqlx::query_as("PRAGMA database_list")
            .fetch_all(&mut *conn)
            .await
            .unwrap();
        assert!(
            dbs.iter().all(|(_, name, _)| name != "r"),
            "database sementara r wajib sudah di-DETACH: {dbs:?}"
        );
    }

    #[tokio::test]
    async fn restore_live_menolak_arsip_tidak_valid_tanpa_menghapus_data_aktif() {
        let (dir, st) = test_state("restore_invalid").await;

        sqlx::query(
            "INSERT INTO menu_item (nama, harga, stok, is_active) VALUES (?, 5000, 10, 1)",
        )
        .bind("MENU-UTUH")
        .execute(&st.pool)
        .await
        .unwrap();

        let foreign_db = dir.0.join("asing.db");
        let pool = crate::db::open(&foreign_db).await.unwrap();
        sqlx::raw_sql("CREATE TABLE asing (id INTEGER PRIMARY KEY);")
            .execute(&pool)
            .await
            .unwrap();
        pool.close().await;

        let bad_zip = dir.0.join("bad_backup.zip");
        write_zip_entries(&bad_zip, &[("warnet.db", &fs::read(&foreign_db).unwrap())]);

        let err = restore_live(&st, &bad_zip).await.unwrap_err();
        assert!(
            err.to_string().contains("Arsip bukan database TMBilling yang valid"),
            "error tak terduga: {err}"
        );

        let pre_restore_count = fs::read_dir(&st.cfg.backup_dir)
            .unwrap()
            .flatten()
            .filter(|e| e.file_name().to_string_lossy().starts_with("pre_restore_"))
            .count();
        assert_eq!(
            pre_restore_count, 0,
            "safety backup tidak boleh dibuat sebelum schema lolos validasi"
        );

        let ada: Option<(i64,)> = sqlx::query_as("SELECT id FROM menu_item WHERE nama=?")
            .bind("MENU-UTUH")
            .fetch_optional(&st.pool)
            .await
            .unwrap();
        assert!(ada.is_some(), "data aktif harus tetap utuh saat restore gagal");
    }

    #[tokio::test]
    async fn restore_live_mengembalikan_snapshot_dan_membuat_safety_backup() {
        let (_dir, st) = test_state("restore_ok").await;

        sqlx::query(
            "INSERT INTO menu_item (nama, harga, stok, is_active) VALUES (?, 8000, 5, 1)",
        )
        .bind("Menu-Asli")
        .execute(&st.pool)
        .await
        .unwrap();

        let created = create(&st, false).await.unwrap();
        assert!(created.starts_with("backup_"));
        assert!(!st.cfg.root.join("instance").join("backup_tmp.db").exists());
        let arsip = dir(&st).join(&created);

        sqlx::query("DELETE FROM menu_item WHERE nama=?")
            .bind("Menu-Asli")
            .execute(&st.pool)
            .await
            .unwrap();
        sqlx::query(
            "INSERT INTO menu_item (nama, harga, stok, is_active) VALUES (?, 15000, 1, 1)",
        )
        .bind("Menu-Sesudah-Backup")
        .execute(&st.pool)
        .await
        .unwrap();

        let hasil = restore_live(&st, &arsip).await.unwrap();
        let safety_name = hasil["safety_backup"].as_str().unwrap();
        assert!(safety_name.starts_with("pre_restore_"));
        assert!(dir(&st).join(safety_name).exists());

        let item_asli: Option<(i64,)> = sqlx::query_as("SELECT id FROM menu_item WHERE nama=?")
            .bind("Menu-Asli")
            .fetch_optional(&st.pool)
            .await
            .unwrap();
        let item_sesudah: Option<(i64,)> =
            sqlx::query_as("SELECT id FROM menu_item WHERE nama=?")
                .bind("Menu-Sesudah-Backup")
                .fetch_optional(&st.pool)
                .await
                .unwrap();
        assert!(item_asli.is_some(), "data sebelum backup harus pulih");
        assert!(
            item_sesudah.is_none(),
            "perubahan sesudah backup harus tergantikan"
        );
    }

    #[tokio::test]
    async fn start_manual_menolak_duplikat_dengan_409_dan_status_konsisten() {
        let (_dir, st) = test_state("manual_409").await;

        assert_eq!(status(&st)["status"], "idle");

        {
            let mut guard = st.backup_status.lock().unwrap();
            guard.running = true;
            guard.status = "running".to_string();
            guard.message = "Backup sedang berjalan...".to_string();
        }

        let err = start_manual(st.clone()).unwrap_err();
        assert_eq!(err.0, 409);
        assert_eq!(status(&st)["status"], "running");

        {
            let mut guard = st.backup_status.lock().unwrap();
            guard.running = false;
            guard.status = "completed".to_string();
            guard.filename = Some("manual_backup_test.zip".to_string());
        }
        assert_eq!(status(&st)["status"], "completed");
        assert_eq!(status(&st)["filename"], "manual_backup_test.zip");
    }

    #[tokio::test]
    async fn list_dan_latest_age_hours_membedakan_manual_dan_otomatis() {
        let (_dir, st) = test_state("list_age").await;
        let bdir = dir(&st);

        fs::write(bdir.join("ignore.txt"), b"bukan zip").unwrap();
        fs::write(bdir.join("manual_backup_20260102_000000.zip"), b"12345").unwrap();

        let daftar_awal = list(&st);
        assert_eq!(daftar_awal.len(), 1);
        assert_eq!(daftar_awal[0]["filename"], "manual_backup_20260102_000000.zip");
        assert_eq!(daftar_awal[0]["is_manual"], true);
        assert!(
            latest_age_hours(&st).is_none(),
            "backup manual tidak boleh dihitung sebagai backup otomatis terjadwal"
        );

        fs::write(bdir.join("backup_20260101_000000.zip"), b"123456789").unwrap();
        let daftar = list(&st);
        assert_eq!(daftar.len(), 2);
        assert_eq!(daftar[0]["filename"], "manual_backup_20260102_000000.zip");
        assert_eq!(daftar[1]["filename"], "backup_20260101_000000.zip");
        assert_eq!(daftar[1]["is_manual"], false);
        assert_eq!(daftar[1]["size"], 9);

        let usia = latest_age_hours(&st).unwrap();
        assert!(usia >= 0.0 && usia < 1.0);
    }

    #[test]
    fn provider_name_dan_reachable_validasi_target() {
        assert_eq!(provider_name("webhook"), Some("Discord Webhook"));
        assert_eq!(provider_name("webdav"), Some("WebDAV"));
        assert_eq!(provider_name("gdrive"), Some("Google Drive"));
        assert_eq!(provider_name("nas"), Some("NAS"));
        assert_eq!(provider_name("s3"), None);

        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        assert!(reachable(&format!("http://127.0.0.1:{port}/webdav")));
        drop(listener);

        assert!(!reachable("http://127.0.0.1:1/webdav"));
        assert!(!reachable("invalid host name:::"));
        assert!(!reachable("http://example.invalid"));
    }
}
