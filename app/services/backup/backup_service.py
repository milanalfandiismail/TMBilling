"""Service untuk backup otomatis database SQLite.

Module ini menyediakan mekanisme backup database secara periodik
menggunakan background thread. Mendukung auto-cleanup file backup
yang sudah melewati batas waktu penyimpanan.
"""

import os
import shutil
import sqlite3
import time
import tempfile
import threading
from datetime import datetime
from app.utils.logger import write_log
from app.services.write_lock import WRITE_LOCK

# Backup terjadwal dan restore tidak boleh berjalan bersamaan.
_BACKUP_LOCK = threading.RLock()


def default_db_path(app=None):
    """Path file SQLite yang sedang dipakai engine; fallback ke instance/warnet.db."""
    try:
        from app.models import db
        url = db.engine.url
        if url.drivername.startswith("sqlite") and url.database and url.database != ":memory:":
            return os.path.abspath(url.database)
    except Exception:
        pass
    if app is not None:
        return os.path.join(app.instance_path, "warnet.db")
    return os.path.abspath(os.path.join("instance", "warnet.db"))


def default_backup_dir(app=None):
    """Direktori backup aktif: env BACKUP_DIR (test/sandbox) lalu instance/../backups."""
    configured = os.environ.get("BACKUP_DIR")
    if configured:
        return os.path.abspath(configured)
    if app is not None:
        return os.path.abspath(os.path.join(app.instance_path, "..", "backups"))
    from flask import current_app
    return os.path.abspath(os.path.join(current_app.instance_path, "..", "backups"))


def _integrity_ok(path):
    con = sqlite3.connect(path)
    try:
        return con.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
    except sqlite3.DatabaseError:
        return False
    finally:
        con.close()


def _snapshot_db(src_path, dest_path):
    """Salinan konsisten lewat SQLite Online Backup API (aman untuk mode WAL)."""
    src = sqlite3.connect(src_path, timeout=30)
    dst = sqlite3.connect(dest_path)
    try:
        src.backup(dst)
    finally:
        dst.close()
        src.close()


class BackupService:
    """Service untuk backup database SQLite secara otomatis.
    
    Mengompresi file database SQLite ke dalam format ZIP dan
    mengunggahnya ke provider cloud yang aktif (Discord, WebDAV, GDrive, NAS).
    Mendukung cleanup otomatis untuk menyimpan maksimal N file cadangan terbaru.
    
    Attributes:
        db_path (str): Path absolut ke file database SQLite.
        backup_dir (str): Path direktori untuk menyimpan file backup.
        interval (int): Interval backup dalam detik (default: 3600 = 1 jam).
    """
    
    def __init__(self, db_path=None, backup_dir='backups', interval=3600):
        """Inisialisasi BackupService.
        
        Args:
            db_path (str): Path absolut ke file database yang akan di-backup.
            backup_dir (str, optional): Direktori tujuan backup. Defaults to 'backups'.
            interval (int, optional): Interval backup dalam detik. Defaults to 3600.
        """
        self.db_path = db_path or default_db_path()
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
        from app.config import Config
        print(f"[v{Config.VERSION}] Backup Service Active | Interval: {self.interval}s")

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
                if os.path.exists(self.db_path):
                    self.create_backup()
                    self.cleanup_old_backups(max_keep=5)
                else:
                    print(f"[BACKUP] File {self.db_path} tidak ditemukan!")
            except Exception as e:
                print(f"[BACKUP] Error: {e}")
            
            time.sleep(self.interval)

    def create_backup(self) -> str:
        """Membuat salinan database terkompresi (.zip) dan mengunggahnya ke cloud provider aktif."""
        import zipfile
        from app.services.settings.settings_service import SettingsService
        from app.services.backup.providers import (
            DiscordWebhookProvider, WebDAVProvider, GoogleDriveProvider, NASBackupProvider, send_multipart_request
        )

        if not os.path.exists(self.db_path):
            raise RuntimeError(f"Database tidak ditemukan: {self.db_path}")

        from app.services.health.health_service import HealthService
        if not HealthService.has_free_space(self.backup_dir):
            raise RuntimeError("Ruang disk backup tidak cukup (< 512 MB)")

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_filename = f"warnet_backup_{timestamp}.zip"
        dest_path = os.path.join(self.backup_dir, backup_filename)
        tmp_path = dest_path + ".tmp"

        # 1. Snapshot konsisten via SQLite Backup API, lalu kompresi ke ZIP
        with _BACKUP_LOCK:
            try:
                _snapshot_db(self.db_path, tmp_path)
                if not _integrity_ok(tmp_path):
                    raise RuntimeError("Snapshot database gagal integrity_check")
                with zipfile.ZipFile(dest_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                    zipf.write(tmp_path, arcname=os.path.basename(self.db_path))
            finally:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)

        print(f"[BACKUP] Database berhasil dikompresi ke: {backup_filename}")
        write_log("DATABASE_BACKUP", f"File: {backup_filename}", user="SYSTEM")

        # 2. Ambil list provider aktif dari database Settings
        providers = []
        
        discord_enabled = SettingsService.get("backup_discord_enabled", "false") == "true"
        discord_url = SettingsService.get("backup_discord_webhook_url", "")
        if discord_enabled and discord_url:
            providers.append(DiscordWebhookProvider(discord_url))

        webdav_enabled = SettingsService.get("backup_webdav_enabled", "false") == "true"
        webdav_url = SettingsService.get("backup_webdav_url", "")
        webdav_user = SettingsService.get("backup_webdav_username", "")
        webdav_pass = SettingsService.get("backup_webdav_password", "")
        if webdav_enabled and webdav_url:
            providers.append(WebDAVProvider(webdav_url, webdav_user, webdav_pass))

        gdrive_enabled = SettingsService.get("backup_gdrive_enabled", "false") == "true"
        gdrive_client_id = SettingsService.get("backup_gdrive_client_id", "")
        gdrive_client_secret = SettingsService.get("backup_gdrive_client_secret", "")
        gdrive_refresh_token = SettingsService.get("backup_gdrive_refresh_token", "")
        gdrive_folder_id = SettingsService.get("backup_gdrive_folder_id", "")
        if gdrive_enabled and gdrive_client_id and gdrive_client_secret and gdrive_refresh_token:
            providers.append(GoogleDriveProvider(gdrive_client_id, gdrive_client_secret, gdrive_refresh_token, gdrive_folder_id))

        nas_enabled = SettingsService.get("backup_nas_enabled", "false") == "true"
        nas_path = SettingsService.get("backup_nas_path", "")
        if nas_enabled and nas_path:
            providers.append(NASBackupProvider(nas_path))

        # 3. Unggah ke masing-masing provider secara sekuensial
        uploaded_success = []
        uploaded_failed = []

        for provider in providers:
            try:
                success = provider.upload(dest_path)
                if success:
                    uploaded_success.append(provider.name)
                    write_log("BACKUP_CLOUD_SUCCESS", f"Berhasil mengunggah ke {provider.name}", user="SYSTEM")
                else:
                    uploaded_failed.append(provider.name)
                    write_log("BACKUP_CLOUD_FAILED", f"Gagal mengunggah ke {provider.name}", user="SYSTEM")
            except Exception as ex:
                uploaded_failed.append(provider.name)
                write_log("BACKUP_CLOUD_FAILED", f"Error pada {provider.name}: {str(ex)}", user="SYSTEM")

        # 4. Kirim notifikasi ringkasan status ke Discord Webhook (jika terkonfigurasi)
        if discord_url:
            status_msg = f"🔔 **TMBilling Backup Summary**\n"
            status_msg += f"• File: `{backup_filename}`\n"
            status_msg += f"• Local Backup: ✅ Success\n"
            
            if uploaded_success:
                status_msg += f"• Uploaded successfully: {', '.join(uploaded_success)} ✅\n"
            if uploaded_failed:
                status_msg += f"• Failed uploading: {', '.join(uploaded_failed)} ❌\n"
                
            try:
                # Mengirimkan pesan teks ringkasan untuk meminimalisasi duplikasi file di Discord
                has_discord_in_success = "Discord Webhook" in uploaded_success
                if not has_discord_in_success or uploaded_failed:
                    send_multipart_request(discord_url, {"content": status_msg}, {})
            except Exception as e:
                print(f"[Backup] Summary notification error: {e}")

        return dest_path

    def restore_backup(self, zip_path) -> dict:
        """Restore database aktif dari arsip ZIP backup lokal.

        Arsip divalidasi lebih dulu, backup pengaman dibuat otomatis, lalu isi
        arsip ditulis ke database aktif memakai SQLite Backup API (tanpa restart).
        """
        import zipfile

        if not os.path.exists(zip_path):
            raise ValueError("Berkas backup tidak ditemukan")

        tmp_dir = tempfile.mkdtemp(prefix="tm_restore_")
        try:
            with zipfile.ZipFile(zip_path) as zipf:
                members = [m for m in zipf.namelist() if m.lower().endswith(".db")]
                if not members:
                    raise ValueError("Arsip backup tidak berisi file database")
                extracted = os.path.join(tmp_dir, "restore.db")
                with zipf.open(members[0]) as src_f, open(extracted, "wb") as dst_f:
                    shutil.copyfileobj(src_f, dst_f)

            if not _integrity_ok(extracted):
                raise ValueError("Arsip backup rusak (integrity_check gagal)")

            with _BACKUP_LOCK, WRITE_LOCK:
                safety_backup = self.create_backup()

                src = sqlite3.connect(extracted)
                dst = sqlite3.connect(self.db_path, timeout=30)
                try:
                    src.backup(dst)
                finally:
                    src.close()
                    dst.close()

                try:
                    from app.models import db
                    db.session.remove()
                    db.engine.dispose()
                except Exception as e:
                    write_log("DATABASE_RESTORE", f"Reset koneksi DB gagal: {e}", user="SYSTEM")

                from app.services.cache import reset_all_cache
                reset_all_cache()
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

        return {
            "restored": os.path.basename(zip_path),
            "safety_backup": os.path.basename(safety_backup),
        }

    def cleanup_old_backups(self, max_keep=5):
        """Menghapus file backup lama dan mempertahankan maksimal N file backup terbaru.
        
        Args:
            max_keep (int): Jumlah file backup terbaru yang ingin disimpan (default: 5).
                           File yang lebih tua akan dihapus otomatis.
        """
        try:
            # Cari semua file backup yang polanya warnet_backup_*.zip
            files = [f for f in os.listdir(self.backup_dir) if f.startswith("warnet_backup_") and f.endswith(".zip")]
            
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