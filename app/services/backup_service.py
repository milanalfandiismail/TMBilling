"""Service untuk backup otomatis database SQLite.

Module ini menyediakan mekanisme backup database secara periodik
menggunakan background thread. Mendukung auto-cleanup file backup
yang sudah melewati batas waktu penyimpanan.
"""

import os
import shutil
import time
import threading
from datetime import datetime
from app.utils.logger import write_log


class BackupService:
    """Service untuk backup database SQLite secara otomatis.
    
    Menjalankan background thread yang secara periodik menyalin
    file database ke folder backup. Mendukung cleanup otomatis
    untuk file backup yang sudah lebih dari N hari.
    
    Attributes:
        db_path (str): Path absolut ke file database SQLite.
        backup_dir (str): Path direktori untuk menyimpan file backup.
        interval (int): Interval backup dalam detik (default: 3600 = 1 jam).
    """
    
    def __init__(self, db_path, backup_dir='backups', interval=3600):
        """Inisialisasi BackupService.
        
        Args:
            db_path (str): Path absolut ke file database yang akan di-backup.
            backup_dir (str, optional): Direktori tujuan backup. Defaults to 'backups'.
            interval (int, optional): Interval backup dalam detik. Defaults to 3600.
        """
        self.db_path = db_path
        self.backup_dir = backup_dir
        self.interval = interval 
        
        if not os.path.exists(self.backup_dir):
            os.makedirs(self.backup_dir)

    def start(self):
        """Memulai background thread untuk backup periodik.
        
        Thread berjalan sebagai daemon sehingga akan otomatis berhenti
        ketika main thread dihentikan.
        """
        thread = threading.Thread(target=self._run, daemon=True)
        thread.start()
        print(f"[v1.0.2] Backup Service Active | Interval: {self.interval}s")

    def _run(self):
        """Loop utama backup yang berjalan di background thread.
        
        Setiap iterasi akan:
        1. Memeriksa keberadaan file database.
        2. Membuat salinan backup.
        3. Membersihkan backup lama (mempertahankan maksimal 5 file terbaru).
        4. Menunggu selama interval sebelum iterasi berikutnya.
        """
        while True:
            try:
                # Cek dulu file DB-nya ada atau nggak sebelum di-copy
                if os.path.exists(self.db_path):
                    self.create_backup()
                    self.cleanup_old_backups(max_keep=5)
                else:
                    print(f"[BACKUP] File {self.db_path} tidak ditemukan!")
            except Exception as e:
                print(f"[BACKUP] Error: {e}")
            
            time.sleep(self.interval)

    def create_backup(self):
        """Membuat salinan file database ke folder backup.
        
        File backup diberi nama dengan format: warnet_backup_YYYYMMDD_HHMMSS.db
        menggunakan timestamp saat backup dilakukan.
        """
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        # Nama file lebih spesifik
        backup_filename = f"warnet_backup_{timestamp}.db"
        dest_path = os.path.join(self.backup_dir, backup_filename)
        
        shutil.copy2(self.db_path, dest_path)
        print(f"[BACKUP] Database berhasil diamankan ke: {backup_filename}")
        write_log("DATABASE_BACKUP", f"File: {backup_filename}", user="SYSTEM")

    def cleanup_old_backups(self, max_keep=5):
        """Menghapus file backup lama dan mempertahankan maksimal N file backup terbaru.
        
        Args:
            max_keep (int): Jumlah file backup terbaru yang ingin disimpan (default: 5).
                           File yang lebih tua akan dihapus otomatis.
        """
        try:
            # Cari semua file backup yang polanya warnet_backup_*.db
            files = [f for f in os.listdir(self.backup_dir) if f.startswith("warnet_backup_") and f.endswith(".db")]
            
            # Urutkan berdasarkan waktu modifikasi secara descending (paling baru di awal)
            files.sort(key=lambda x: os.path.getmtime(os.path.join(self.backup_dir, x)), reverse=True)
            
            # Hapus file yang melebihi limit
            if len(files) > max_keep:
                files_to_delete = files[max_keep:]
                for f in files_to_delete:
                    path = os.path.join(self.backup_dir, f)
                    if os.path.exists(path):
                        os.remove(path)
                        print(f"🧹 [BACKUP] File lama dibuang karena melebihi limit {max_keep}: {f}")
                        write_log("BACKUP_CLEANUP", f"Menghapus file lama (limit {max_keep}): {f}", user="SYSTEM")
        except Exception as e:
            print(f"[BACKUP] Gagal melakukan cleanup: {e}")