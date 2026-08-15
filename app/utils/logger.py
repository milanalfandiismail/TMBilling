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


def write_log(aksi, detail, user="kasir", detail_json=None):
    """Menulis satu baris log ke file warnet.log.
    
    Args:
        aksi (str): Kode aksi yang dilakukan (contoh: 'LOGIN', 'BUKA_GUEST', 'BLACKOUT_DETECT').
        detail (str): Deskripsi detail dari aksi tersebut.
        user (str, optional): Identitas pelaku aksi. Defaults to 'kasir'.
        detail_json (dict, optional): Detail payload tambahan dalam bentuk JSON. Defaults to None.
        
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

    log_entry = {
        "timestamp": now,
        "user": user,
        "action": aksi,
        "detail": detail,
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
            return json.loads(line_str)
        except Exception:
            pass
    
    match = LEGACY_LOG_PATTERN.match(line_str)
    if match:
        ts, user, action, detail = match.groups()
        return {
            "timestamp": ts,
            "user": user,
            "action": action,
            "detail": detail,
            "ip_address": "-",
            "browser_agent": "-",
            "detail_json": None
        }
    
    return {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "user": "system",
        "action": "RAW_LOG",
        "detail": line_str,
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