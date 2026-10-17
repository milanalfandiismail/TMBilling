# app/services/settings/db_maintenance_service.py

"""Service untuk pembersihan histori operasional database dan optimasi fisik SQLite.

Module ini menyediakan fungsi pembersihan histori transaksi, sesi, log uptime,
telemetri proses, dan tiket perbaikan tua, dilanjutkan dengan eksekusi VACUUM;
untuk mengembalikan kapasitas disk secara fisik ke sistem operasi.
"""

import os
import shutil
from datetime import timedelta, datetime
from sqlalchemy import text
from app.models import db, now_local


class DBMaintenanceService:
    """Service pemeliharaan database SQLite dan pembersihan data histori."""

    @staticmethod
    def _format_size(bytes_val: float) -> str:
        for unit in ["B", "KB", "MB", "GB"]:
            if bytes_val < 1024.0:
                return f"{bytes_val:.2f} {unit}"
            bytes_val /= 1024.0
        return f"{bytes_val:.2f} TB"

    @classmethod
    def get_database_stats(cls) -> dict:
        """Mengambil ukuran fisik database SQLite dan ringkasan total baris data operasional."""
        db_uri = db.engine.url.database or "warnet.db"
        if not os.path.isabs(db_uri):
            db_path = os.path.join(os.getcwd(), db_uri)
            if not os.path.exists(db_path) and os.path.exists(os.path.join(os.getcwd(), "instance", db_uri)):
                db_path = os.path.join(os.getcwd(), "instance", db_uri)
        else:
            db_path = db_uri

        db_size_bytes = os.path.getsize(db_path) if os.path.exists(db_path) else 0

        tables_to_count = [
            ("pc_process", "SELECT COUNT(*) FROM pc_process"),
            ("pc_uptime_log", "SELECT COUNT(*) FROM pc_uptime_log"),
            ("maintenance_ticket", "SELECT COUNT(*) FROM maintenance_ticket"),
            ("transaksi_menu", "SELECT COUNT(*) FROM transaksi_menu"),
            ("transaksi", "SELECT COUNT(*) FROM transaksi"),
            ("sesi", "SELECT COUNT(*) FROM sesi"),
            ("shift_record", "SELECT COUNT(*) FROM shift_record"),
        ]

        history_counts = {}
        total_history_rows = 0
        for key, query in tables_to_count:
            try:
                cnt = db.session.execute(text(query)).scalar() or 0
                history_counts[key] = cnt
                total_history_rows += cnt
            except Exception:
                history_counts[key] = 0

        archive_dir = os.path.join(os.getcwd(), "backups", "archive")
        last_archive = None
        if os.path.exists(archive_dir):
            files = [
                f for f in os.listdir(archive_dir)
                if f.startswith("warnet_pre_purge_") and f.endswith(".db")
            ]
            if files:
                files.sort(reverse=True)
                latest_file = files[0]
                latest_path = os.path.join(archive_dir, latest_file)
                mtime = os.path.getmtime(latest_path)
                mtime_dt = datetime.fromtimestamp(mtime)
                last_archive = {
                    "filename": latest_file,
                    "date": f"{mtime_dt.day:02d}/{mtime_dt.month:02d}/{mtime_dt.year} {mtime_dt.hour:02d}:{mtime_dt.minute:02d}",
                    "size_human": cls._format_size(os.path.getsize(latest_path)),
                }

        status = "warning" if db_size_bytes > 50 * 1024 * 1024 or total_history_rows > 50000 else "optimal"

        return {
            "db_path": db_path,
            "db_size_bytes": db_size_bytes,
            "db_size_human": cls._format_size(db_size_bytes),
            "total_history_rows": total_history_rows,
            "history_breakdown": history_counts,
            "last_archive": last_archive,
            "status": status,
        }

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
        from app.utils.validators import validate_choice
        retention_months = validate_choice(retention_months, [1, 3, 6, 12], field_name="Masa Retensi")

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
