# app/utils/helpers.py

"""Fungsi utilitas umum untuk aplikasi TMBilling.

Module ini berisi fungsi-fungsi pembantu yang digunakan di berbagai
bagian aplikasi, termasuk validasi, formatting, dan wrapper untuk
tugas-tugas terjadwal (scheduler).
"""

import re
import os
import shutil
from datetime import datetime
from flask import current_app
from app.services import SesiService
from app.utils.logger import write_log  # pakai logger kamu


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