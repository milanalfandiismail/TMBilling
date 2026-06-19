"""Entry point utama aplikasi TMBilling.

Module ini bertanggung jawab untuk:
1. Membuat instance aplikasi Flask via factory pattern.
2. Mendaftarkan tugas scheduler (APScheduler) untuk:
   - Cleanup sesi expired setiap 1 menit.
   - Backup database otomatis setiap 60 menit.
3. Menjalankan development server pada port 5000.

Note:
    Scheduler dilindungi dari double-execution saat Flask debug
    mode (reloader) aktif menggunakan WERKZEUG_RUN_MAIN check.

Usage:
    python run.py
"""

from app import create_app
from apscheduler.schedulers.background import BackgroundScheduler
from app.utils.helpers import run_cleanup_expired, run_database_backup, run_cleanup_logs, UNIT_MULTIPLIER
import os

app = create_app()


def get_scheduler_interval(settings_key, settings_unit_key, default_value, default_unit):
    """Baca interval scheduler dari tabel settings."""
    try:
        from app.services import SettingsService
        value = int(SettingsService.get(settings_key, default_value))
        unit = SettingsService.get(settings_unit_key, default_unit)
        return value * UNIT_MULTIPLIER.get(unit, UNIT_MULTIPLIER[default_unit])
    except Exception:
        return default_value * UNIT_MULTIPLIER[default_unit]


def start_scheduler(app):
    """Buat dan start scheduler dengan interval dari DB."""
    scheduler = BackgroundScheduler()

    # Task 1: Cleanup expired sessions every minute
    scheduler.add_job(
        func=run_cleanup_expired,
        args=[app],
        trigger="interval",
        seconds=60,
        id="cleanup_expired"
    )

    # Task 2: Database backup (interval dinamis)
    backup_seconds = get_scheduler_interval("auto_backup_value", "auto_backup_unit", 60, "menit")
    scheduler.add_job(
        func=run_database_backup,
        args=[app],
        trigger="interval",
        seconds=backup_seconds,
        id="database_backup"
    )

    # Task 3: Cleanup log (interval dinamis)
    cleanup_seconds = get_scheduler_interval("auto_cleanup_value", "auto_cleanup_unit", 30, "hari")
    scheduler.add_job(
        func=run_cleanup_logs,
        args=[app],
        trigger="interval",
        seconds=cleanup_seconds,
        id="cleanup_logs"
    )

    return scheduler


scheduler = start_scheduler(app)

if __name__ == "__main__":
    # Cegah double execution saat Flask debug mode (reloader) aktif
    if not app.debug or os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        scheduler.start()
        print("[v1.0] Background Tasks Started (Cleanup & Backup)")
    
    # Mode produksi menggunakan Waitress jika DEBUG_MODE = False
    is_debug = app.config.get("DEBUG_MODE", False)
    if is_debug:
        app.run(debug=True, host="0.0.0.0", port=7015)
    else:
        # Menjalankan server dalam mode produksi menggunakan Waitress (direkomendasikan untuk Windows)
        # Mengambil konfigurasi threads dari app.config (default: 8)
        threads_count = app.config.get("WAITRESS_THREADS", 8)
        from waitress import serve
        print("* [PRODUCTION] Menjalankan server TMBilling menggunakan WSGI Waitress...")
        print("* [PRODUCTION] Alamat: http://0.0.0.0:7015")
        print(f"* [PRODUCTION] Threads (Workers): {threads_count}")
        serve(app, host="0.0.0.0", port=7015, threads=threads_count)