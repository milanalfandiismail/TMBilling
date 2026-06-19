# app/utils/helpers.py

"""Fungsi utilitas umum untuk aplikasi TMBilling.

Module ini berisi fungsi-fungsi pembantu yang digunakan di berbagai
bagian aplikasi, termasuk validasi, formatting, dan wrapper untuk
tugas-tugas terjadwal (scheduler).
"""

import re
import os
import shutil
from datetime import datetime, timedelta
from flask import current_app
from app.services import SesiService
from app.utils.logger import write_log  # pakai logger kamu

UNIT_MULTIPLIER = {
    "detik": 1,
    "menit": 60,
    "jam": 3600,
    "hari": 86400,
    "minggu": 604800,
}


def validate_ip(ip):
    """Memvalidasi format alamat IP (IPv4).
    
    Args:
        ip (str): String alamat IP yang akan divalidasi.
        
    Returns:
        bool: True jika format valid atau ip kosong/None, False jika format salah.
        
    Example:
        >>> validate_ip("192.168.1.1")
        True
        >>> validate_ip("999.999.999.999")
        True  # Hanya cek format, bukan range
        >>> validate_ip("abc")
        False
    """
    if not ip:
        return True
    return re.match(r'^(\d{1,3}\.){3}\d{1,3}$', ip) is not None


def format_duration(menit):
    """Memformat durasi menit ke format yang mudah dibaca.
    
    Args:
        menit (int): Jumlah menit yang akan diformat.
        
    Returns:
        str: String durasi yang sudah diformat.
        
    Example:
        >>> format_duration(0)
        'Habis'
        >>> format_duration(45)
        '45 Menit'
        >>> format_duration(120)
        '2 Jam'
        >>> format_duration(150)
        '2 Jam 30M'
    """
    if menit <= 0:
        return "Habis"
    
    jam = menit // 60
    sisa = menit % 60
    
    if jam == 0:
        return f"{sisa} Menit"
    elif sisa == 0:
        return f"{jam} Jam"
    else:
        return f"{jam} Jam {sisa}M"


def format_rupiah(nominal):
    """Memformat angka nominal ke format Rupiah Indonesia.

    Args:
        nominal (int): Nominal dalam satuan Rupiah.

    Returns:
        str: String dengan format 'Rp10.000' (standar EYD/PUEBI tanpa spasi).
    """
    if nominal is None:
        nominal = 0
    formatted = f"{int(nominal):,}".replace(",", ".")
    return f"Rp{formatted}"


def run_cleanup_expired(app):
    """Wrapper untuk cleanup_expired yang dijalankan oleh scheduler.
    
    Fungsi ini membungkus SesiService.cleanup_expired() dengan
    Flask application context agar bisa dijalankan dari APScheduler
    background thread.
    
    Args:
        app (Flask): Instance aplikasi Flask untuk membuat app context.
        
    Returns:
        int: Jumlah sesi yang berhasil ditutup otomatis.
    """
    #write_log("SCHEDULER", "cleanup_expired dijalankan")
    
    with app.app_context():
        count = SesiService.cleanup_expired()
        # if count > 0:
        #     write_log("SCHEDULER", f"{count} sesi expired ditutup")
        # else:
        #     write_log("SCHEDULER", "Tidak ada sesi expired")
        # return count
    

def run_database_backup(app):
    """Wrapper untuk backup database yang dijalankan oleh scheduler.
    
    Fungsi ini mendelegasikan proses backup dan pembersihan file lama
    ke BackupService secara terpusat dengan batasan maksimal 5 file backup terbaru.
    
    Args:
        app (Flask): Instance aplikasi Flask untuk mendapatkan path database.
    """
    with app.app_context():
        db_path = os.path.join(app.instance_path, 'warnet.db') 
        backup_dir = os.path.abspath(os.path.join(app.instance_path, '..', 'backups'))
        
        try:
            from app.services import BackupService
            backup_manager = BackupService(db_path=db_path, backup_dir=backup_dir)
            if os.path.exists(db_path):
                backup_manager.create_backup()
                backup_manager.cleanup_old_backups(max_keep=5)
            else:
                write_log("BACKUP_ERROR", f"File {db_path} tidak ditemukan!", user="SYSTEM")
        except Exception as e:
            write_log("BACKUP_ERROR", f"Error backup: {str(e)}", user="SYSTEM")


def run_cleanup_logs(app):
    """Wrapper untuk cleanup log file yang dijalankan oleh scheduler.
    
    Membaca file logs/warnet.log, hapus baris yang lebih lama dari
    periode yang ditentukan di settings (auto_cleanup_value + auto_cleanup_unit).
    
    Args:
        app (Flask): Instance aplikasi Flask untuk membaca settings.
    """
    with app.app_context():
        from app.utils.logger import LOG_FILE
        from app.services import SettingsService
        
        try:
            value = int(SettingsService.get("auto_cleanup_value", 30))
            unit = SettingsService.get("auto_cleanup_unit", "hari")
            seconds = value * UNIT_MULTIPLIER.get(unit, 86400)
            cutoff = datetime.now() - timedelta(seconds=seconds)
            
            if not os.path.exists(LOG_FILE):
                return
            
            kept_lines = []
            removed = 0
            
            with open(LOG_FILE, "r", encoding="utf-8") as f:
                for line in f:
                    line_stripped = line.strip()
                    if not line_stripped:
                        continue
                    # Format: [YYYY-MM-DD HH:MM:SS] [user] AKSI - detail
                    match = re.match(r'\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]', line_stripped)
                    if match:
                        log_time = datetime.strptime(match.group(1), "%Y-%m-%d %H:%M:%S")
                        if log_time >= cutoff:
                            kept_lines.append(line)
                        else:
                            removed += 1
                    else:
                        kept_lines.append(line)
            
            if removed > 0:
                with open(LOG_FILE, "w", encoding="utf-8") as f:
                    f.writelines(kept_lines)
                write_log("SCHEDULER", f"Cleanup log: {removed} baris lama dihapus (>{value} {unit})", user="SYSTEM")
        except Exception as e:
            write_log("SCHEDULER_ERROR", f"Error cleanup log: {str(e)}", user="SYSTEM")