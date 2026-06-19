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
from datetime import datetime

LOG_DIR = "logs"
LOG_FILE = os.path.join(LOG_DIR, "warnet.log")

# Buat folder logs jika belum ada
os.makedirs(LOG_DIR, exist_ok=True)


def write_log(aksi, detail, user="kasir"):
    """Menulis satu baris log ke file warnet.log.
    
    Args:
        aksi (str): Kode aksi yang dilakukan (contoh: 'LOGIN', 'BUKA_GUEST', 'BLACKOUT_DETECT').
        detail (str): Deskripsi detail dari aksi tersebut.
        user (str, optional): Identitas pelaku aksi. Defaults to 'kasir'.
        
    Example:
        >>> write_log("LOGIN", "Kasir admin login", user="admin")
        # Output: [2026-04-12 18:30:00] [admin] LOGIN - Kasir admin login
    """
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_line = f"[{now}] [{user}] {aksi} - {detail}\n"
    
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(log_line)
    
    print(f"[LOG] {log_line.strip()}")


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
        if filter_text and filter_text.lower() not in line.lower():
            continue
        logs.append(line.strip())
        if len(logs) >= limit:
            break
    
    return logs


def clear_logs():
    """Menghapus seluruh isi file log (reset ke kosong).
    
    Returns:
        bool: True jika berhasil menghapus log, False jika file tidak ditemukan.
    """
    if os.path.exists(LOG_FILE):
        with open(LOG_FILE, "w", encoding="utf-8") as f:
            f.write("")
        return True
    return False