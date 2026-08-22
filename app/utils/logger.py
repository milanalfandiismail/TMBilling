# app/utils/logger.py

"""Modul logging kustom untuk aplikasi TMBilling.

Module ini menyediakan sistem pencatatan log file-based sederhana
untuk merekam aktivitas sistem, audit trail kasir, dan insiden blackout.
Log disimpan dalam format text file di folder 'logs/warnet.log'.

Format log:
    [YYYY-MM-DD HH:MM:SS] [user] AKSI - detail

Constants:
    LOG_DIR (str): Nama direktori penyimpanan log.
    LOG_FILE (str): Path lengkap ke file log utama.
"""

import os
import re
import json
import gzip
from datetime import datetime
from flask import has_request_context, request

LOG_DIR = "logs"
LOG_ARCHIVE_DIR = os.path.join(LOG_DIR, "archives")
LOG_FILE = os.path.join(LOG_DIR, "warnet.log")

# Buat folder logs jika belum ada
os.makedirs(LOG_DIR, exist_ok=True)
os.makedirs(LOG_ARCHIVE_DIR, exist_ok=True)

LEGACY_LOG_PATTERN = re.compile(r"^\[(.*?)\] \[(.*?)\] (.*?) - (.*)$")

ACTION_TO_CATEGORY_MAP = {
    # 1. AUTHENTICATION
    "LOGIN": "AUTHENTICATION",
    "LOGOUT": "AUTHENTICATION",
    "LOGIN_GAGAL": "AUTHENTICATION",
    "LOGIN_MEMBER": "AUTHENTICATION",
    "CLIENT_ADMIN_LOGIN": "AUTHENTICATION",
    "EMERGENCY_LOGIN": "AUTHENTICATION",
    "REMOTE_LOGOUT": "AUTHENTICATION",
    "LOGOUT_ERROR": "AUTHENTICATION",

    # 2. USER_ACCOUNT
    "TAMBAH_USER": "USER_ACCOUNT",
    "UPDATE_USER": "USER_ACCOUNT",
    "HAPUS_USER": "USER_ACCOUNT",
    "TAMBAH_MEMBER": "USER_ACCOUNT",
    "EDIT_MEMBER": "USER_ACCOUNT",
    "DELETE_MEMBER": "USER_ACCOUNT",
    "TAMBAH_GRUP": "USER_ACCOUNT",
    "EDIT_GRUP": "USER_ACCOUNT",
    "HAPUS_GRUP": "USER_ACCOUNT",

    # 3. AUTHORIZATION_SECURITY
    "ADMIN_CHECK_SUCCESS": "AUTHORIZATION_SECURITY",
    "ADMIN_CHECK_FAILED": "AUTHORIZATION_SECURITY",
    "ADMIN_CHECK_DENIED": "AUTHORIZATION_SECURITY",
    "IP_WHITELIST_ADD": "AUTHORIZATION_SECURITY",
    "IP_WHITELIST_REMOVE": "AUTHORIZATION_SECURITY",
    "IP_WHITELIST_BLOCK": "AUTHORIZATION_SECURITY",
    "IP_WHITELIST_SESSION_DESTROY": "AUTHORIZATION_SECURITY",
    "IP_WHITELIST_TOGGLE": "AUTHORIZATION_SECURITY",
    "IP_WHITELIST_TOKEN_REGEN": "AUTHORIZATION_SECURITY",
    "API_KEY_GAGAL": "AUTHORIZATION_SECURITY",
    "SETTINGS_APIKEY_CHANGE": "AUTHORIZATION_SECURITY",

    # 4. PAYMENT_BILLING
    "PAYMENT_METHOD_CONFIG": "PAYMENT_BILLING",
    "SETTINGS_QRIS_CHANGE": "PAYMENT_BILLING",
    "TOPUP_MEMBER": "PAYMENT_BILLING",
    "TRANSAKSI": "PAYMENT_BILLING",
    "TRANSAKSI_MENU": "PAYMENT_BILLING",
    "REFUND_PAKET": "PAYMENT_BILLING",

    # 5. TRANSACTION
    "DELETE_STRUK": "TRANSACTION",
    "SHIFT_BUKA": "TRANSACTION",
    "SHIFT_TUTUP": "TRANSACTION",

    # 6. SESI_BILLING
    "BUKA_GUEST": "SESI_BILLING",
    "BUKA_MEMBER": "SESI_BILLING",
    "TAMBAH_WAKTU": "SESI_BILLING",
    "PINDAH_PC": "SESI_BILLING",
    "TUTUP_SESI": "SESI_BILLING",
    "TUTUP_SESI_ERROR": "SESI_BILLING",
    "CLEANUP": "SESI_BILLING",

    # 7. DATA_CATALOG
    "TAMBAH_MENU": "DATA_CATALOG",
    "EDIT_MENU": "DATA_CATALOG",
    "HAPUS_MENU": "DATA_CATALOG",
    "HAPUS_MENU_PERMANEN": "DATA_CATALOG",
    "ARSIP_MENU": "DATA_CATALOG",
    "RESTORE_MENU": "DATA_CATALOG",
    "TAMBAH_PAKET": "DATA_CATALOG",
    "EDIT_PAKET": "DATA_CATALOG",
    "HAPUS_PAKET": "DATA_CATALOG",
    "TAMBAH_PC": "DATA_CATALOG",
    "EDIT_PC": "DATA_CATALOG",
    "HAPUS_PC": "DATA_CATALOG",
    "BATCH_PC": "DATA_CATALOG",
    "WOL_PACKET": "DATA_CATALOG",
    "RESET_ADMIN": "DATA_CATALOG",

    # 8. MONITOR_REMOTE
    "REMOTE_ACTION": "MONITOR_REMOTE",
    "REMOTE_KILL": "MONITOR_REMOTE",
    "REMOTE_SCREENSHOT_TRIGGER": "MONITOR_REMOTE",
    "VNC_START": "MONITOR_REMOTE",
    "SCREENSHOT_UPLOAD": "MONITOR_REMOTE",
    "SCREENSHOT_UPLOAD_ERROR": "MONITOR_REMOTE",
    "MONITOR": "MONITOR_REMOTE",
    "MONITOR_ERROR": "MONITOR_REMOTE",
    "HARDWARE_ALERT": "MONITOR_REMOTE",
    "UPDATE_BASELINE": "MONITOR_REMOTE",
    "HAPUS_MONITOR": "MONITOR_REMOTE",
    "IDENTIFY_START": "MONITOR_REMOTE",
    "IDENTIFY_SUCCESS": "MONITOR_REMOTE",
    "IDENTIFY_FAIL": "MONITOR_REMOTE",
    "IDENTIFY_REJECTED": "MONITOR_REMOTE",
    "IDENTIFY_AUTO_REG": "MONITOR_REMOTE",
    "STATUS_AUTO_REG": "MONITOR_REMOTE",
    "STATUS_REJECTED": "MONITOR_REMOTE",
    "CLIENT_STATUS_CRASH": "MONITOR_REMOTE",
    "CLIENT_STATUS_ERROR": "MONITOR_REMOTE",
    "CLIENT_STATUS_MAC_FALLBACK": "MONITOR_REMOTE",
    "CLIENT_STATUS_UNKNOWN": "MONITOR_REMOTE",
    "CLIENT_TUTUP_ERROR": "MONITOR_REMOTE",

    # 9. TOURNAMENT_GAME
    "TOURNAMENT_CREATE": "TOURNAMENT_GAME",
    "TOURNAMENT_DELETE": "TOURNAMENT_GAME",
    "TOURNAMENT_SCORE_UPDATE": "TOURNAMENT_GAME",
    "TOURNAMENT_STAGE_UPDATE": "TOURNAMENT_GAME",
    "GAME_CREATE": "TOURNAMENT_GAME",
    "GAME_UPDATE": "TOURNAMENT_GAME",
    "GAME_DELETE": "TOURNAMENT_GAME",

    # 10. CONFIGURATION
    "SETTINGS_AUTO_SHUTDOWN": "CONFIGURATION",
    "SETTINGS_TIMEZONE": "CONFIGURATION",
    "SETTINGS_UPDATE": "CONFIGURATION",
    "IP_WHITELIST_PUBLIC_URL": "CONFIGURATION",
    "CLOUDFLARE_TUNNEL_SAVE_TOKEN": "CONFIGURATION",
    "CLOUDFLARE_TUNNEL_TOGGLE": "CONFIGURATION",

    # 11. API_INTEGRATION
    "MIKROTIK_CONFIG": "API_INTEGRATION",
    "MIKROTIK_ERROR": "API_INTEGRATION",
    "MIKROTIK_SYNC": "API_INTEGRATION",

    # 12. BACKGROUND_JOB
    "SCHEDULER": "BACKGROUND_JOB",
    "SCHEDULER_CONFIG": "BACKGROUND_JOB",
    "SCHEDULER_ERROR": "BACKGROUND_JOB",
    "SCHEDULER_RESTART": "BACKGROUND_JOB",

    # 13. MAINTENANCE
    "CLEAR_LOG": "MAINTENANCE",
    "CLEAR_ALL_HISTORY": "MAINTENANCE",
    "CLEAR_TANGGAL": "MAINTENANCE",
    "DB_MAINTENANCE": "MAINTENANCE",
    "DATABASE_BACKUP": "MAINTENANCE",
    "DATABASE_DOWNLOAD": "MAINTENANCE",
    "MANUAL_BACKUP": "MAINTENANCE",
    "BACKUP_CLEANUP": "MAINTENANCE",
    "BACKUP_DELETE": "MAINTENANCE",
    "BACKUP_CLOUD_SUCCESS": "MAINTENANCE",
    "BACKUP_CLOUD_FAILED": "MAINTENANCE",
    "BACKUP_TEST_CONNECTION": "MAINTENANCE",
    "DATABASE_MIGRATION_UPGRADE": "MAINTENANCE",
    "BUAT_TIKET": "MAINTENANCE",
    "UPDATE_TIKET": "MAINTENANCE",
    "HAPUS_TIKET": "MAINTENANCE",
    "FILE_EXPLORER_SAVE": "MAINTENANCE",
    "FILE_EXPLORER_CREATE": "MAINTENANCE",
    "FILE_EXPLORER_RENAME": "MAINTENANCE",
    "FILE_EXPLORER_DELETE": "MAINTENANCE",
    "FILE_EXPLORER_ROOTS_UPDATE": "MAINTENANCE",

    # 14. SYSTEM
    "BLACKOUT_DETECT": "SYSTEM",
    "BLACKOUT_RESOLVE_MEMBER": "SYSTEM",
    "BLACKOUT_RESOLVE_GUEST_LANJUT": "SYSTEM",
    "BLACKOUT_RESOLVE_GUEST_SAMA": "SYSTEM",
    "BLACKOUT_RESOLVE_TUTUP": "SYSTEM",
    "BLACKOUT_CLEAR": "SYSTEM",
    "FORCE_CLOSE_ALL": "SYSTEM",
    "ACCESS_DASHBOARD": "SYSTEM",
    "APPLICATION_UPDATE": "SYSTEM",

    # 15. ERROR_FAILURE
    "ERROR": "ERROR_FAILURE",
    "DB_ERROR": "ERROR_FAILURE",
    "BACKUP_ERROR": "ERROR_FAILURE",
    "DATABASE_MIGRATION_ERROR": "ERROR_FAILURE",
    "SYNC_ERROR": "ERROR_FAILURE",
    "UPTIME_SERVICE_ERROR": "ERROR_FAILURE",
}


def write_log(aksi, detail, user="kasir", detail_json=None, category=None):
    """Menulis satu baris log ke file warnet.log.
    
    Args:
        aksi (str): Kode aksi yang dilakukan (contoh: 'LOGIN', 'BUKA_GUEST', 'BLACKOUT_DETECT').
        detail (str): Deskripsi detail dari aksi tersebut.
        user (str, optional): Identitas pelaku aksi. Defaults to 'kasir'.
        detail_json (dict, optional): Detail payload tambahan dalam bentuk JSON. Defaults to None.
        category (str, optional): Kategori log. Jika tidak ada, di-resolve dari ACTION_TO_CATEGORY_MAP.
        
    Example:
        >>> write_log("LOGIN", "Kasir admin login", user="admin")
        # Output: {"timestamp": "2026-04-12 18:30:00", "user": "admin", ...}
    """
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    ip_address = "-"
    browser_agent = "-"
    
    if has_request_context():
        x_forwarded = request.headers.get("X-Forwarded-For")
        if x_forwarded:
            ip_address = x_forwarded.split(",")[0].strip()
        else:
            ip_address = request.remote_addr or "-"
        browser_agent = request.user_agent.string or "-"
    elif user == "SYSTEM":
        browser_agent = "SYSTEM"

    if not category:
        category = ACTION_TO_CATEGORY_MAP.get(aksi.upper(), "SYSTEM")

    log_entry = {
        "timestamp": now,
        "user": user,
        "action": aksi,
        "detail": detail,
        "category": category,
        "ip_address": ip_address,
        "browser_agent": browser_agent,
        "detail_json": detail_json
    }
    
    log_line = json.dumps(log_entry) + "\n"
    
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(log_line)
    
    print(f"[LOG] {now} [{user}] {aksi} - {detail}")


def read_logs(limit=500, filter_text=None):
    """Membaca log dari file dengan dukungan filter dan limit.
    
    Args:
        limit (int, optional): Jumlah maksimal baris log yang dikembalikan. Defaults to 500.
        filter_text (str, optional): Teks filter untuk memfilter log (case-insensitive).
                                     Jika None, semua baris akan dikembalikan.
        
    Returns:
        list[str]: Daftar baris log yang sudah di-strip, diurutkan dari terbaru ke terlama.
    """
    if not os.path.exists(LOG_FILE):
        return []
    
    logs = []
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        lines = f.readlines()
    
    # Balik urutan (yang terbaru di atas)
    for line in reversed(lines):
        line_str = line.strip()
        if not line_str:
            continue
        if filter_text and filter_text.lower() not in line_str.lower():
            continue
        logs.append(line_str)
        if len(logs) >= limit:
            break
    
    return logs


def normalize_legacy_log_line(line: str) -> dict:
    """Mengubah format log legacy teks atau JSON ke dictionary standar."""
    line_str = line.strip()
    if not line_str:
        return {}
    if line_str.startswith("{") and line_str.endswith("}"):
        try:
            data = json.loads(line_str)
            if "category" not in data:
                action = data.get("action", "")
                data["category"] = ACTION_TO_CATEGORY_MAP.get(action.upper(), "SYSTEM")
            return data
        except Exception:
            pass
    
    match = LEGACY_LOG_PATTERN.match(line_str)
    if match:
        ts, user, action, detail = match.groups()
        category = ACTION_TO_CATEGORY_MAP.get(action.upper(), "SYSTEM")
        return {
            "timestamp": ts,
            "user": user,
            "action": action,
            "detail": detail,
            "category": category,
            "ip_address": "-",
            "browser_agent": "-",
            "detail_json": None
        }
    
    return {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "user": "system",
        "action": "RAW_LOG",
        "detail": line_str,
        "category": "SYSTEM",
        "ip_address": "-",
        "browser_agent": "-",
        "detail_json": None
    }

def archive_logs(archive_dir: str = LOG_ARCHIVE_DIR) -> dict:
    """Mengompresi dan mengarsipkan file log saat ini ke format .jsonl.gz."""
    if not os.path.exists(LOG_FILE) or os.path.getsize(LOG_FILE) == 0:
        return {"archived": False, "archive_path": None, "total_lines": 0}

    os.makedirs(archive_dir, exist_ok=True)
    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    archive_filename = f"warnet_{timestamp_str}.jsonl.gz"
    archive_path = os.path.join(archive_dir, archive_filename)

    lines_count = 0
    with open(LOG_FILE, "r", encoding="utf-8") as f_in:
        with gzip.open(archive_path, "wt", encoding="utf-8") as f_out:
            for line in f_in:
                normalized = normalize_legacy_log_line(line)
                if normalized:
                    f_out.write(json.dumps(normalized) + "\n")
                    lines_count += 1

    return {
        "archived": True,
        "archive_path": archive_path,
        "archive_filename": archive_filename,
        "total_lines": lines_count
    }

def clear_logs(archive: bool = True) -> dict:
    """Mengosongkan isi file log dengan opsi auto-archive."""
    archive_info = {"archived": False, "archive_path": None, "total_lines": 0}
    if archive and os.path.exists(LOG_FILE):
        archive_info = archive_logs()

    if os.path.exists(LOG_FILE):
        with open(LOG_FILE, "w", encoding="utf-8") as f:
            f.write("")
        return {
            "success": True,
            "total_lines": archive_info.get("total_lines", 0),
            "archive_path": archive_info.get("archive_path")
        }
    return {"success": False, "total_lines": 0, "archive_path": None}