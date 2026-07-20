# app/utils/scheduler_tasks.py

"""Wrapper untuk background tasks scheduler (APScheduler)."""

import os
import re
from datetime import datetime, timedelta
from app.services import SesiService
from app.utils.logger import write_log

UNIT_MULTIPLIER = {
    "detik": 1,
    "menit": 60,
    "jam": 3600,
    "hari": 86400,
    "minggu": 604800,
}


def run_cleanup_expired(app):
    """Wrapper untuk cleanup_expired yang dijalankan oleh scheduler.
    
    Fungsi ini membungkus SesiService.cleanup_expired() dengan
    Flask application context agar bisa dijalankan dari APScheduler
    background thread.
    """
    with app.app_context():
        SesiService.cleanup_expired()


def run_database_backup(app):
    """Wrapper untuk backup database yang dijalankan oleh scheduler.
    
    Fungsi ini mendelegasikan proses backup dan pembersihan file lama
    ke BackupService secara terpusat dengan batasan maksimal 5 file backup terbaru.
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
    periode yang ditentukan di settings.
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


def run_auto_screenshots(app):
    """Wrapper untuk auto-screenshot yang dijalankan oleh scheduler."""
    with app.app_context():
        from app.services import SettingsService, ClientService
        from app.repositories import SesiRepository
        
        try:
            enabled = SettingsService.get("screenshot_auto_enabled", "0")
            if enabled == "1" or str(enabled).lower() == "true":
                active_sessions = SesiRepository.get_all_aktif()
                count = 0
                for sesi in active_sessions:
                    if sesi.pc_id:
                        ClientService.queue_command(sesi.pc_id, "screenshot")
                        count += 1
        except Exception as e:
            write_log("SCHEDULER_ERROR", f"Error auto-screenshot: {str(e)}", user="SYSTEM")
