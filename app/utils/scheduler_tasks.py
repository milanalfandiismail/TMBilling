# app/utils/scheduler_tasks.py

"""Wrapper untuk background tasks scheduler (APScheduler)."""

import json
import os
import re
from datetime import datetime, timedelta
from app.utils.timezone_utils import format_local_now
from app.services import SesiService
from app.utils.logger import write_log

UNIT_MULTIPLIER = {
    "detik": 1,
    "menit": 60,
    "jam": 3600,
    "hari": 86400,
    "minggu": 604800,
    "bulan": 2592000,
}

_SETTINGS_KEY = "scheduler_last_runs"
_LAST_RUN = {}


def record_run(job_id, ok=True):
    """Catat eksekusi terakhir per job di memori dan simpan ke Settings."""
    _LAST_RUN[job_id] = {"at": format_local_now("%Y-%m-%dT%H:%M:%S"), "ok": bool(ok)}
    try:
        from app.services import SettingsService
        SettingsService.set(_SETTINGS_KEY, json.dumps(_LAST_RUN))
    except Exception as e:
        write_log("SCHEDULER_STATUS_ERROR", f"Gagal menyimpan status job {job_id}: {e}")


def get_last_runs():
    if not _LAST_RUN:
        try:
            from app.services import SettingsService
            data = json.loads(SettingsService.get(_SETTINGS_KEY, "{}") or "{}")
            _LAST_RUN.update(data)
        except Exception:
            pass
    return dict(_LAST_RUN)


def run_cleanup_expired(app):
    """Wrapper untuk cleanup_expired yang dijalankan oleh scheduler.
    
    Fungsi ini membungkus SesiService.cleanup_expired() dengan
    Flask application context agar bisa dijalankan dari APScheduler
    background thread.
    """
    with app.app_context():
        try:
            SesiService.cleanup_expired()
            SesiService.cleanup_inactive_admin_sessions()
            from app.services.blackout.blackout_service import BlackoutService
            BlackoutService.deteksi()
        except Exception as e:
            write_log("SCHEDULER_ERROR", f"Error cleanup sesi: {e}", user="SYSTEM")
            record_run("cleanup_expired", False)
            raise
        record_run("cleanup_expired", True)


def run_database_backup(app):
    """Wrapper untuk backup database yang dijalankan oleh scheduler.
    
    Fungsi ini mendelegasikan proses backup dan pembersihan file lama
    ke BackupService secara terpusat dengan batasan maksimal 5 file backup terbaru.
    """
    with app.app_context():
        from app.services import BackupService
        from app.services.backup.backup_service import default_db_path, default_backup_dir
        db_path = default_db_path(app)
        backup_dir = default_backup_dir(app)

        try:
            backup_manager = BackupService(db_path=db_path, backup_dir=backup_dir)
            if os.path.exists(db_path):
                report = {}
                backup_manager.create_backup(report=report)
                backup_manager.cleanup_old_backups(max_keep=5)
                failed = report.get("failed") or []
                if failed:
                    write_log(
                        "BACKUP_CLOUD_FAILED",
                        "Unggahan cloud gagal: " + ", ".join(failed),
                        user="SYSTEM",
                    )
                record_run("database_backup", not failed)
                return
            else:
                write_log("BACKUP_ERROR", f"File {db_path} tidak ditemukan!", user="SYSTEM")
                record_run("database_backup", False)
                return
        except Exception as e:
            write_log("BACKUP_ERROR", f"Error backup: {str(e)}", user="SYSTEM")
            record_run("database_backup", False)
            return
        record_run("database_backup", True)


def run_cleanup_logs(app):
    """Wrapper untuk cleanup log file yang dijalankan oleh scheduler.
    
    Membaca file logs/warnet.log, hapus baris yang lebih lama dari
    periode yang ditentukan di settings.
    """
    with app.app_context():
        from app.utils.logger import atomic_filter_logs, write_log
        from app.services import SettingsService
        
        try:
            value = int(SettingsService.get("auto_cleanup_value", 30))
            unit = SettingsService.get("auto_cleanup_unit", "hari")
            seconds = value * UNIT_MULTIPLIER.get(unit, 86400)
            cutoff = datetime.strptime(format_local_now(), "%Y-%m-%d %H:%M:%S") - timedelta(seconds=seconds)
            
            def should_keep(data):
                ts = data.get("timestamp")
                if ts:
                    try:
                        log_time = datetime.strptime(ts, "%Y-%m-%d %H:%M:%S")
                        return log_time >= cutoff
                    except Exception:
                        pass
                return True

            removed = atomic_filter_logs(should_keep)
            if removed > 0:
                write_log("SCHEDULER", f"Cleanup log: {removed} baris lama dihapus (>{value} {unit})", user="SYSTEM")
        except Exception as e:
            write_log("SCHEDULER_ERROR", f"Error cleanup log: {str(e)}", user="SYSTEM")
            record_run("cleanup_logs", False)
            return
        record_run("cleanup_logs", True)


def run_auto_screenshots(app):
    """Wrapper untuk auto-screenshot yang dijalankan oleh scheduler."""
    with app.app_context():
        from app.services import SettingsService, ClientService
        from app.services.health.health_service import HealthService
        from app.repositories import SesiRepository

        screenshot_dir = os.path.join(app.instance_path, "uploads", "screenshots")
        if not HealthService.has_free_space(screenshot_dir):
            write_log("SCHEDULER", "Screenshot otomatis dilewati: ruang disk < 512 MB", user="SYSTEM")
            record_run("auto_screenshots", True)
            return
        
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
            record_run("auto_screenshots", False)
            return
        record_run("auto_screenshots", True)


def run_flush_uptime(app):
    """Wrapper untuk batch flush akumulasi uptime PC ke SQLite yang dijalankan setiap 1 menit."""
    with app.app_context():
        try:
            from app.services.hardware.uptime_service import UptimeService
            UptimeService.flush_uptime_to_db(app=app)
        except Exception as e:
            write_log("SCHEDULER_ERROR", f"Error flush uptime: {str(e)}", user="SYSTEM")
            record_run("flush_uptime", False)
            return
        record_run("flush_uptime", True)

def run_cleanup_vnc_proxies(app):
    """Wrapper untuk cleanup proxy VNC dan token yang orphaned/stale."""
    with app.app_context():
        try:
            from app.services.vnc.vnc_service import VNCClientProxyService
            cleaned = VNCClientProxyService.cleanup_stale_proxies()
            if cleaned > 0:
                from app.utils.logger import write_log
                write_log("VNC_CLEANUP", f"Cleanup VNC proxy: {cleaned} proxy/token orphaned dibersihkan", user="SYSTEM")
        except Exception as e:
            from app.utils.logger import write_log
            write_log("SCHEDULER_ERROR", f"Error cleanup VNC proxy: {str(e)}", user="SYSTEM")
            record_run("cleanup_vnc_proxies", False)
            return
        record_run("cleanup_vnc_proxies", True)
