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
from app.utils.scheduler_tasks import (
    run_cleanup_expired,
    run_database_backup,
    run_cleanup_logs,
    run_auto_screenshots,
    run_flush_uptime,
    run_cleanup_vnc_proxies,
    UNIT_MULTIPLIER,
)
import os
import time

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

    # Task 4: Auto Screenshot (interval dinamis)
    screenshot_seconds = get_scheduler_interval("screenshot_auto_value", "screenshot_auto_unit", 60, "detik")
    scheduler.add_job(
        func=run_auto_screenshots,
        args=[app],
        trigger="interval",
        seconds=screenshot_seconds,
        id="auto_screenshots"
    )

    # Task 5: Batch Flush Uptime In-Memory ke SQLite (interval 60 detik)
    scheduler.add_job(
        func=run_flush_uptime,
        args=[app],
        trigger="interval",
        seconds=60,
        id="flush_uptime"
    )

    # Task 6: Cleanup orphaned VNC client proxies (interval 120 detik)
    scheduler.add_job(
        func=run_cleanup_vnc_proxies,
        args=[app],
        trigger="interval",
        seconds=120,
        id="cleanup_vnc_proxies"
    )

    import atexit
    atexit.register(lambda: run_flush_uptime(app))

    return scheduler


scheduler = start_scheduler(app)

if __name__ == "__main__":
    # Cegah double execution saat Flask debug mode (reloader) aktif
    if not app.debug or os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        scheduler.start()
        version = app.config.get("VERSION", "1.5.0")
        print(f"[v{version}] Background Tasks Started (Cleanup & Backup)")
    
    # Port & Host configuration (bisa via env PORT/HOST atau CLI flag --port / -p)
    import sys
    server_port = int(os.environ.get("PORT", 7015))
    server_host = os.environ.get("HOST", "0.0.0.0")
    for i, arg in enumerate(sys.argv):
        if arg in ("--port", "-p") and i + 1 < len(sys.argv):
            try:
                server_port = int(sys.argv[i + 1])
            except ValueError:
                pass

    # Mode produksi menggunakan Waitress jika DEBUG_MODE = False
    is_debug = app.config.get("DEBUG_MODE", False)
    if is_debug:
        is_gui = "pythonw" in sys.executable.lower()
        app.run(debug=True, host=server_host, port=server_port, use_reloader=not is_gui)
    else:
        # Menjalankan server dalam mode produksi menggunakan Waitress (direkomendasikan untuk Windows)
        # Mengambil konfigurasi threads dari app.config (default: 8)
        threads_count = app.config.get("WAITRESS_THREADS", 8)
        from waitress import serve
        print("* [PRODUCTION] Menjalankan server TMBilling menggunakan WSGI Waitress...")
        print(f"* [PRODUCTION] Alamat: http://{server_host}:{server_port}")
        print(f"* [PRODUCTION] Threads (Workers): {threads_count}")
        serve(app, host=server_host, port=server_port, threads=threads_count)
