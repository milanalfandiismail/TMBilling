# cron_tasks.py

"""Script untuk menjalankan scheduled tasks (cron) di PythonAnywhere.

Script ini dirancang untuk dieksekusi secara periodik menggunakan menu
'Scheduled Tasks' di PythonAnywhere. Script ini akan:
1. Menutup sesi-sesi billing yang sudah habis waktunya (cleanup expired).
2. Melakukan backup otomatis database SQLite.
"""

from app import create_app
from app.utils.helpers import run_cleanup_expired, run_database_backup

def main():
    print("⏳ Memulai eksekusi scheduled tasks...")
    app = create_app()
    
    # 1. Jalankan pembersihan sesi kedaluwarsa
    print("🧹 Menjalankan pembersihan sesi expired...")
    run_cleanup_expired(app)
    
    # 2. Jalankan backup database
    print("💾 Menjalankan backup database otomatis...")
    run_database_backup(app)
    
    print("✅ Semua tugas berhasil diselesaikan!")

if __name__ == "__main__":
    main()
