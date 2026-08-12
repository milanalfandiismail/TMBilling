# app/services/settings/db_maintenance_service.py

"""Service untuk pembersihan histori operasional database dan optimasi fisik SQLite.

Module ini menyediakan fungsi pembersihan histori transaksi, sesi, log uptime,
telemetri proses, dan tiket perbaikan tua, dilanjutkan dengan eksekusi VACUUM;
untuk mengembalikan kapasitas disk secara fisik ke sistem operasi.
"""

import os
import shutil
from datetime import timedelta
from sqlalchemy import text
from app.models import db, now_local


class DBMaintenanceService:
    """Service pemeliharaan database SQLite dan pembersihan data histori."""

    @staticmethod
    def purge_and_vacuum(retention_months: int) -> dict:
        """Membersihkan histori operasional berumur lebih tua dari retention_months
        dan mengompresi fisik file database SQLite via VACUUM.

        Args:
            retention_months (int): Batas umur data dalam bulan (1, 3, 6, atau 12).

        Returns:
            dict: Ringkasan hasil pembersihan data dan penghematan memori disk.

        Raises:
            ValueError: Jika retention_months tidak valid.
            FileNotFoundError: Jika file database warnet.db tidak ditemukan.
        """
        if retention_months not in (1, 3, 6, 12):
            raise ValueError("Masa retensi harus 1, 3, 6, atau 12 bulan.")

        # 1. Lokasi folder archive cadangan khusus
        archive_dir = os.path.join(os.getcwd(), "backups", "archive")
        os.makedirs(archive_dir, exist_ok=True)

        # Snapshot file cadangan sebelum pembersihan
        timestamp = now_local().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"warnet_pre_purge_{timestamp}.db"
        backup_path = os.path.join(archive_dir, backup_filename)

        # Dapatkan path asli warnet.db dari URI SQLAlchemy
        db_uri = db.engine.url.database
        if not db_uri:
            db_uri = "warnet.db"

        if not os.path.isabs(db_uri):
            db_path = os.path.join(os.getcwd(), db_uri)
            if not os.path.exists(db_path) and os.path.exists(os.path.join(os.getcwd(), "instance", db_uri)):
                db_path = os.path.join(os.getcwd(), "instance", db_uri)
        else:
            db_path = db_uri

        initial_size = os.path.getsize(db_path) if os.path.exists(db_path) else 0

        # Copy file SQLite ke folder backups/archive/
        if os.path.exists(db_path):
            shutil.copy2(db_path, backup_path)

        # 2. Hitung tanggal cutoff
        cutoff_date = now_local() - timedelta(days=retention_months * 30)

        deleted_summary = {}

        # 3. Purge data histori yang lebih tua dari cutoff_date
        # pc_process
        r = db.session.execute(
            text("DELETE FROM pc_process WHERE last_update < :cutoff"),
            {"cutoff": cutoff_date}
        )
        deleted_summary["pc_process"] = r.rowcount

        # pc_uptime_log
        r = db.session.execute(
            text("DELETE FROM pc_uptime_log WHERE tanggal < :cutoff_date"),
            {"cutoff_date": cutoff_date.date()}
        )
        deleted_summary["pc_uptime_log"] = r.rowcount

        # maintenance_ticket (hanya status SELESAI / DITOLAK)
        r = db.session.execute(
            text("DELETE FROM maintenance_ticket WHERE status IN ('SELESAI', 'DITOLAK') AND created_at < :cutoff"),
            {"cutoff": cutoff_date}
        )
        deleted_summary["maintenance_ticket"] = r.rowcount

        # transaksi_menu
        r = db.session.execute(
            text("DELETE FROM transaksi_menu WHERE tanggal < :cutoff"),
            {"cutoff": cutoff_date}
        )
        deleted_summary["transaksi_menu"] = r.rowcount

        # transaksi
        r = db.session.execute(
            text("DELETE FROM transaksi WHERE dibuat_pada < :cutoff"),
            {"cutoff": cutoff_date}
        )
        deleted_summary["transaksi"] = r.rowcount

        # sesi (hanya status selesai)
        r = db.session.execute(
            text("DELETE FROM sesi WHERE status = 'selesai' AND selesai_pada < :cutoff"),
            {"cutoff": cutoff_date}
        )
        deleted_summary["sesi"] = r.rowcount

        # shift_record (hanya status SELESAI)
        r = db.session.execute(
            text("DELETE FROM shift_record WHERE status = 'SELESAI' AND waktu_mulai < :cutoff"),
            {"cutoff": cutoff_date}
        )
        deleted_summary["shift_record"] = r.rowcount

        db.session.commit()

        # 4. Perform SQLite physical VACUUM & PRAGMA optimize
        db.session.execute(text("VACUUM;"))
        db.session.execute(text("PRAGMA optimize;"))

        final_size = os.path.getsize(db_path) if os.path.exists(db_path) else initial_size

        def format_size(bytes_val):
            for unit in ["B", "KB", "MB", "GB"]:
                if bytes_val < 1024.0:
                    return f"{bytes_val:.2f} {unit}"
                bytes_val /= 1024.0
            return f"{bytes_val:.2f} TB"

        return {
            "success": True,
            "message": "Pembersihan database dan optimasi VACUUM berhasil dieksekusi.",
            "backup_file": backup_filename,
            "retention_months": retention_months,
            "cutoff_date": cutoff_date.strftime("%Y-%m-%d %H:%M:%S"),
            "deleted_summary": deleted_summary,
            "storage_stats": {
                "initial_size_bytes": initial_size,
                "final_size_bytes": final_size,
                "initial_size_human": format_size(initial_size),
                "final_size_human": format_size(final_size),
                "saved_space_human": format_size(max(0, initial_size - final_size)),
            },
        }
