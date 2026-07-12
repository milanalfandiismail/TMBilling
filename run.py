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
from app.utils.helpers import run_cleanup_expired, run_database_backup, run_cleanup_logs, run_auto_screenshots, UNIT_MULTIPLIER
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


# ==============================================================================
# RELEASE MODE (Auto-Extract + Database Migration)
# ==============================================================================
def run_release_update(zip_path=None):
    """Jalankan update release dengan auto migrasi database.

    Args:
        zip_path: Path ke file ZIP release (default: app/update/TMBilling_Server_vX.X.zip)
    """
    import zipfile
    import shutil
    import subprocess
    from flask_migrate import upgrade

    print("=" * 60)
    print("RELEASE UPDATE MODE")
    print("=" * 60)

    # Cari ZIP file terbaru
    if not zip_path:
        update_dir = os.path.join(app.root_path, '..', 'update')
        if not os.path.exists(update_dir):
            os.makedirs(update_dir)

        zip_files = [f for f in os.listdir(update_dir) if f.endswith('.zip')]
        if not zip_files:
            print("[ERROR] Tidak ada file ZIP update di app/update/")
            return False

        # Ambil yang terbaru (urutan nama file)
        zip_files.sort(reverse=True)
        zip_path = os.path.join(update_dir, zip_files[0])
        print(f"[INFO] File ZIP terbaru: {zip_files[0]}")

    # Extract ZIP
    print(f"[INFO] Extract ZIP ke app/update/...")
    temp_dir = os.path.join(update_dir, "extract_temp")
    with zipfile.ZipFile(zip_path, 'r') as zf:
        zf.extractall(temp_dir)

    # Deteksi folder migrations
    migrations_dir = os.path.join(temp_dir, "migrations")
    has_migration = os.path.exists(migrations_dir)

    if has_migration:
        print("[INFO] ✅ Folder migrations ditemukan - akan melakukan DATABASE MIGRATION")
        target_migrations = os.path.join(app.root_path, '..', 'migrations')

        # Backup migrations sebelum replace (opsional)
        if os.path.exists(target_migrations):
            backup_migrations = os.path.join(target_migrations, f"backup_{int(time.time())}")
            shutil.copytree(target_migrations, backup_migrations)
            print(f"[INFO] Migrations backup ke: {backup_migrations}")

        # Replace migrations
        if os.path.exists(target_migrations):
            shutil.rmtree(target_migrations)
        shutil.copytree(migrations_dir, target_migrations)

        # Jalankan migration
        print("[INFO] Menjalankan database migration...")
        try:
            upgrade(directory=target_migrations)
            print("[SUCCESS] ✅ Database migration selesai ke HEAD!")
        except Exception as e:
            print(f"[ERROR] ❌ Gagal migrasi database: {str(e)}")
            # Restore migrations dari backup
            if os.path.exists(backup_migrations):
                shutil.rmtree(target_migrations)
                shutil.copytree(backup_migrations, target_migrations)
                print("[INFO] Migrations di-rollback dari backup")
            return False
    else:
        print("[INFO] ⚠️ Tidak ada folder migrations - hanya update aplikasi biasa")

    # Jalankan release script (run.py) dari temp dir
    release_script = os.path.join(temp_dir, "run.py")
    if os.path.exists(release_script):
        print(f"[INFO] Menjalankan release script: {release_script}")

        # Ganti working directory ke temp dir
        original_cwd = os.getcwd()
        try:
            os.chdir(temp_dir)

            # Jalankan release script dalam subprocess (isolate environment)
            result = subprocess.run(
                [".venv/Scripts/python.exe", release_script],
                capture_output=True,
                text=True,
                timeout=300  # 5 menit timeout
            )

            if result.returncode == 0:
                print("[SUCCESS] ✅ Release script selesai!")
                print(f"[INFO] Output: {result.stdout}")
            else:
                print(f"[ERROR] ❌ Release script gagal: {result.stderr}")
                return False

        finally:
            os.chdir(original_cwd)
    else:
        print("[INFO] Tidak ada run.py di dalam ZIP")

    # Cleanup temp dir
    shutil.rmtree(temp_dir)
    print("[INFO] Cleanup temp directory")

    print("=" * 60)
    print("[SUCCESS] Release update selesai!")
    print("[SUCCESS] Database sudah di-migrate ke HEAD")
    print("[SUCCESS] Silakan restart server untuk menerapkan perubahan")
    print("=" * 60)

    return True


# Command line interface untuk release mode
if __name__ == "__main__":
    # Cek apakah user minta release mode
    import sys
    if "--release" in sys.argv:
        if len(sys.argv) > 1:
            run_release_update(sys.argv[1])
        else:
            run_release_update()
        sys.exit(0)