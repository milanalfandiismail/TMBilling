//! Audit trail JSON per baris ke `logs/warnet.log`, dengan arsip gzip.
//!
//! Skema baris wajib sama dengan versi Python; pembaca log lama bergantung pada nama field.

use crate::utils::time;
use serde_json::{json, Value};
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

static LOG_DIR: OnceLock<PathBuf> = OnceLock::new();
static TZ: OnceLock<String> = OnceLock::new();
static WRITE: Mutex<()> = Mutex::new(());

/// Panggil sekali saat startup. Panggilan kedua diabaikan sehingga tes tidak saling menimpa.
pub fn init(log_dir: impl Into<PathBuf>, tz_name: impl Into<String>) -> bool {
    let ok_dir = LOG_DIR.set(log_dir.into()).is_ok();
    let _ = TZ.set(tz_name.into());
    ok_dir
}

fn log_path() -> PathBuf {
    LOG_DIR
        .get()
        .cloned()
        .unwrap_or_else(|| PathBuf::from("logs"))
        .join("warnet.log")
}

fn tz_name() -> &'static str {
    TZ.get()
        .map(String::as_str)
        .unwrap_or(crate::utils::time::DEFAULT_TZ)
}

/// Tulis satu entri audit. `category` kosong di-resolve dari tabel aksi.
pub fn audit(
    user: &str,
    action: &str,
    detail: &str,
    category: Option<&str>,
    ip_address: &str,
    browser_agent: &str,
) {
    write_entry(
        user,
        action,
        detail,
        category,
        ip_address,
        browser_agent,
        None,
    );
}

pub fn rec(user: &str, action: &str, detail: &str) {
    audit(user, action, detail, None, "", "");
}

pub fn audit_json(
    user: &str,
    action: &str,
    detail: &str,
    category: Option<&str>,
    ip_address: &str,
    browser_agent: &str,
    detail_json: Value,
) {
    write_entry(
        user,
        action,
        detail,
        category,
        ip_address,
        browser_agent,
        Some(detail_json),
    );
}

fn write_entry(
    user: &str,
    action: &str,
    detail: &str,
    category: Option<&str>,
    ip_address: &str,
    browser_agent: &str,
    detail_json: Option<Value>,
) {
    let category = category
        .filter(|c| !c.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| resolve_category(action).to_string());
    let entry = json!({
        "timestamp": time::format_local_now(tz_name()),
        "user": if user.is_empty() { "kasir" } else { user },
        "action": action,
        "detail": detail,
        "category": category,
        "ip_address": if ip_address.is_empty() { "-" } else { ip_address },
        "browser_agent": if browser_agent.is_empty() { "-" } else { browser_agent },
        "detail_json": detail_json,
    });
    let line = format!("{entry}\n");
    let path = log_path();
    let _guard = WRITE.lock().unwrap();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&path) {
        let _ = f.write_all(line.as_bytes());
    }
}

pub fn resolve_category(action: &str) -> &'static str {
    let upper = action.to_ascii_uppercase();
    ACTION_TO_CATEGORY
        .iter()
        .find(|(k, _)| *k == upper)
        .map(|(_, v)| *v)
        .unwrap_or("SYSTEM")
}

/// Arsipkan `warnet.log` ke `archives/warnet_<stamp>.log.gz`, sisakan `max_archives` arsip terbaru.
pub fn archive(max_archives: usize) -> anyhow::Result<Option<PathBuf>> {
    let path = log_path();
    if !path.exists() {
        return Ok(None);
    }
    let dir = path.parent().unwrap_or(Path::new(".")).join("archives");
    fs::create_dir_all(&dir)?;
    let stamp = time::now_local(tz_name())
        .format("%Y%m%d_%H%M%S")
        .to_string();
    let target = dir.join(format!("warnet_{stamp}.log.gz"));
    let mut input = File::open(&path)?;
    let mut out =
        flate2::write::GzEncoder::new(File::create(&target)?, flate2::Compression::default());
    std::io::copy(&mut input, &mut out)?;
    out.finish()?;
    File::create(&path)?;

    let mut archives: Vec<PathBuf> = fs::read_dir(&dir)?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.extension().map(|e| e == "gz").unwrap_or(false))
        .collect();
    archives.sort();
    while archives.len() > max_archives {
        let _ = fs::remove_file(archives.remove(0));
    }
    Ok(Some(target))
}

pub static ACTION_TO_CATEGORY: &[(&str, &str)] = &[
    ("LOGIN", "AUTHENTICATION"),
    ("LOGOUT", "AUTHENTICATION"),
    ("LOGIN_GAGAL", "AUTHENTICATION"),
    ("LOGIN_MEMBER", "AUTHENTICATION"),
    ("CLIENT_ADMIN_LOGIN", "AUTHENTICATION"),
    ("EMERGENCY_LOGIN", "AUTHENTICATION"),
    ("REMOTE_LOGOUT", "AUTHENTICATION"),
    ("LOGOUT_ERROR", "AUTHENTICATION"),
    ("TAMBAH_USER", "USER_ACCOUNT"),
    ("UPDATE_USER", "USER_ACCOUNT"),
    ("HAPUS_USER", "USER_ACCOUNT"),
    ("TAMBAH_MEMBER", "USER_ACCOUNT"),
    ("EDIT_MEMBER", "USER_ACCOUNT"),
    ("DELETE_MEMBER", "USER_ACCOUNT"),
    ("TAMBAH_GRUP", "USER_ACCOUNT"),
    ("EDIT_GRUP", "USER_ACCOUNT"),
    ("HAPUS_GRUP", "USER_ACCOUNT"),
    ("ADMIN_CHECK_SUCCESS", "AUTHORIZATION_SECURITY"),
    ("ADMIN_CHECK_FAILED", "AUTHORIZATION_SECURITY"),
    ("ADMIN_CHECK_DENIED", "AUTHORIZATION_SECURITY"),
    ("IP_WHITELIST_ADD", "AUTHORIZATION_SECURITY"),
    ("IP_WHITELIST_REMOVE", "AUTHORIZATION_SECURITY"),
    ("IP_WHITELIST_BLOCK", "AUTHORIZATION_SECURITY"),
    ("IP_WHITELIST_SESSION_DESTROY", "AUTHORIZATION_SECURITY"),
    ("IP_WHITELIST_TOGGLE", "AUTHORIZATION_SECURITY"),
    ("IP_WHITELIST_TOKEN_REGEN", "AUTHORIZATION_SECURITY"),
    ("API_KEY_GAGAL", "AUTHORIZATION_SECURITY"),
    ("SETTINGS_APIKEY_CHANGE", "AUTHORIZATION_SECURITY"),
    ("PAYMENT_METHOD_CONFIG", "PAYMENT_BILLING"),
    ("SETTINGS_QRIS_CHANGE", "PAYMENT_BILLING"),
    ("TOPUP_MEMBER", "PAYMENT_BILLING"),
    ("TRANSAKSI", "PAYMENT_BILLING"),
    ("TRANSAKSI_MENU", "PAYMENT_BILLING"),
    ("REFUND_PAKET", "PAYMENT_BILLING"),
    ("DELETE_STRUK", "TRANSACTION"),
    ("SHIFT_BUKA", "TRANSACTION"),
    ("SHIFT_TUTUP", "TRANSACTION"),
    ("SHIFT_FORCE_CLOSE", "TRANSACTION"),
    ("BUKA_GUEST", "SESI_BILLING"),
    ("BUKA_MEMBER", "SESI_BILLING"),
    ("TAMBAH_WAKTU", "SESI_BILLING"),
    ("PINDAH_PC", "SESI_BILLING"),
    ("TUTUP_SESI", "SESI_BILLING"),
    ("TUTUP_SESI_ERROR", "SESI_BILLING"),
    ("CLEANUP", "SESI_BILLING"),
    ("TAMBAH_MENU", "DATA_CATALOG"),
    ("EDIT_MENU", "DATA_CATALOG"),
    ("HAPUS_MENU", "DATA_CATALOG"),
    ("HAPUS_MENU_PERMANEN", "DATA_CATALOG"),
    ("ARSIP_MENU", "DATA_CATALOG"),
    ("RESTORE_MENU", "DATA_CATALOG"),
    ("RESTOCK_MENU", "DATA_CATALOG"),
    ("TAMBAH_STOK_MENU", "DATA_CATALOG"),
    ("TAMBAH_PAKET", "DATA_CATALOG"),
    ("EDIT_PAKET", "DATA_CATALOG"),
    ("HAPUS_PAKET", "DATA_CATALOG"),
    ("TAMBAH_PC", "DATA_CATALOG"),
    ("EDIT_PC", "DATA_CATALOG"),
    ("HAPUS_PC", "DATA_CATALOG"),
    ("BATCH_PC", "DATA_CATALOG"),
    ("WOL_PACKET", "DATA_CATALOG"),
    ("RESET_ADMIN", "DATA_CATALOG"),
    ("REMOTE_ACTION", "MONITOR_REMOTE"),
    ("REMOTE_KILL", "MONITOR_REMOTE"),
    ("REMOTE_SCREENSHOT_TRIGGER", "MONITOR_REMOTE"),
    ("VNC_START", "MONITOR_REMOTE"),
    ("SCREENSHOT_UPLOAD", "MONITOR_REMOTE"),
    ("SCREENSHOT_UPLOAD_ERROR", "MONITOR_REMOTE"),
    ("MONITOR", "MONITOR_REMOTE"),
    ("MONITOR_ERROR", "MONITOR_REMOTE"),
    ("HARDWARE_ALERT", "MONITOR_REMOTE"),
    ("UPDATE_BASELINE", "MONITOR_REMOTE"),
    ("HAPUS_MONITOR", "MONITOR_REMOTE"),
    ("IDENTIFY_START", "MONITOR_REMOTE"),
    ("IDENTIFY_SUCCESS", "MONITOR_REMOTE"),
    ("IDENTIFY_FAIL", "MONITOR_REMOTE"),
    ("IDENTIFY_REJECTED", "MONITOR_REMOTE"),
    ("IDENTIFY_AUTO_REG", "MONITOR_REMOTE"),
    ("STATUS_AUTO_REG", "MONITOR_REMOTE"),
    ("STATUS_REJECTED", "MONITOR_REMOTE"),
    ("CLIENT_STATUS_CRASH", "MONITOR_REMOTE"),
    ("CLIENT_STATUS_ERROR", "MONITOR_REMOTE"),
    ("CLIENT_STATUS_MAC_FALLBACK", "MONITOR_REMOTE"),
    ("CLIENT_STATUS_UNKNOWN", "MONITOR_REMOTE"),
    ("CLIENT_TUTUP_ERROR", "MONITOR_REMOTE"),
    ("TOURNAMENT_CREATE", "TOURNAMENT_GAME"),
    ("TOURNAMENT_DELETE", "TOURNAMENT_GAME"),
    ("TOURNAMENT_SCORE_UPDATE", "TOURNAMENT_GAME"),
    ("TOURNAMENT_STAGE_UPDATE", "TOURNAMENT_GAME"),
    ("GAME_CREATE", "TOURNAMENT_GAME"),
    ("GAME_UPDATE", "TOURNAMENT_GAME"),
    ("GAME_DELETE", "TOURNAMENT_GAME"),
    ("SETTINGS_AUTO_SHUTDOWN", "CONFIGURATION"),
    ("SETTINGS_TIMEZONE", "CONFIGURATION"),
    ("SETTINGS_UPDATE", "CONFIGURATION"),
    ("IP_WHITELIST_PUBLIC_URL", "CONFIGURATION"),
    ("CLOUDFLARE_TUNNEL_SAVE_TOKEN", "CONFIGURATION"),
    ("CLOUDFLARE_TUNNEL_TOGGLE", "CONFIGURATION"),
    ("MIKROTIK_CONFIG", "API_INTEGRATION"),
    ("MIKROTIK_ERROR", "API_INTEGRATION"),
    ("MIKROTIK_SYNC", "API_INTEGRATION"),
    ("SCHEDULER", "BACKGROUND_JOB"),
    ("SCHEDULER_CONFIG", "BACKGROUND_JOB"),
    ("SCHEDULER_ERROR", "BACKGROUND_JOB"),
    ("SCHEDULER_RESTART", "BACKGROUND_JOB"),
    ("CLEAR_LOG", "MAINTENANCE"),
    ("CLEAR_ALL_HISTORY", "MAINTENANCE"),
    ("CLEAR_TANGGAL", "MAINTENANCE"),
    ("DB_MAINTENANCE", "MAINTENANCE"),
    ("DATABASE_BACKUP", "MAINTENANCE"),
    ("DATABASE_DOWNLOAD", "MAINTENANCE"),
    ("MANUAL_BACKUP", "MAINTENANCE"),
    ("BACKUP_CLEANUP", "MAINTENANCE"),
    ("BACKUP_DELETE", "MAINTENANCE"),
    ("BACKUP_CLOUD_SUCCESS", "MAINTENANCE"),
    ("BACKUP_CLOUD_FAILED", "MAINTENANCE"),
    ("BACKUP_TEST_CONNECTION", "MAINTENANCE"),
    ("DATABASE_MIGRATION_UPGRADE", "MAINTENANCE"),
    ("BUAT_TIKET", "MAINTENANCE"),
    ("UPDATE_TIKET", "MAINTENANCE"),
    ("HAPUS_TIKET", "MAINTENANCE"),
    ("BLACKOUT_DETECT", "SYSTEM"),
    ("BLACKOUT_RESOLVE_MEMBER", "SYSTEM"),
    ("BLACKOUT_RESOLVE_GUEST_LANJUT", "SYSTEM"),
    ("BLACKOUT_RESOLVE_GUEST_SAMA", "SYSTEM"),
    ("BLACKOUT_RESOLVE_TUTUP", "SYSTEM"),
    ("BLACKOUT_CLEAR", "SYSTEM"),
    ("FORCE_CLOSE_ALL", "SYSTEM"),
    ("ACCESS_DASHBOARD", "SYSTEM"),
    ("APPLICATION_UPDATE", "SYSTEM"),
    ("ERROR", "ERROR_FAILURE"),
    ("DB_ERROR", "ERROR_FAILURE"),
    ("BACKUP_ERROR", "ERROR_FAILURE"),
    ("DATABASE_MIGRATION_ERROR", "ERROR_FAILURE"),
    ("SYNC_ERROR", "ERROR_FAILURE"),
    ("UPTIME_SERVICE_ERROR", "ERROR_FAILURE"),
];
