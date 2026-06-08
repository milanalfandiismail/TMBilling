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
from app.utils.helpers import run_cleanup_expired, run_database_backup
import os

app = create_app()


# Background Tasks Scheduler
scheduler = BackgroundScheduler()

# Task 1: Cleanup expired sessions every minute
scheduler.add_job(
    func=run_cleanup_expired,
    args=[app],
    trigger="interval",
    minutes=1,
    id="cleanup_expired"
)

# Task 2: Database backup every 60 minutes
scheduler.add_job(
    func=run_database_backup,
    args=[app],
    trigger="interval",
    minutes=60,
    id="database_backup"
)

if __name__ == "__main__":
    # Cegah double execution saat Flask debug mode (reloader) aktif
    if not app.debug or os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        scheduler.start()
        print("[v1.0.6-alpha2] Background Tasks Started (Cleanup & Backup)")
    
    # Mode produksi menggunakan Waitress jika DEBUG_MODE = False
    is_debug = app.config.get("DEBUG_MODE", False)
    if is_debug:
        app.run(debug=True, host="0.0.0.0", port=7015)
    else:
        # Menjalankan server dalam mode produksi menggunakan Waitress (direkomendasikan untuk Windows)
        # Mengambil konfigurasi threads dari app.config (default: 8)
        threads_count = app.config.get("WAITRESS_THREADS", 8)
        from waitress import serve
        print("🚀 [PRODUCTION] Menjalankan server TMBilling menggunakan WSGI Waitress...")
        print("🔗 [PRODUCTION] Alamat: http://0.0.0.0:7015")
        print(f"🧵 [PRODUCTION] Threads (Workers): {threads_count}")
        serve(app, host="0.0.0.0", port=7015, threads=threads_count)