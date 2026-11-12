"""Status kesehatan ringkas: database, disk, dan backup terjadwal."""

import os
import shutil

MIN_FREE_BYTES = 512 * 1024 * 1024


class HealthService:
    @staticmethod
    def free_bytes(path):
        try:
            return shutil.disk_usage(path).free
        except OSError:
            return None

    @classmethod
    def disk_status(cls, path):
        free = cls.free_bytes(path)
        if free is None:
            return "unknown"
        return "ok" if free >= MIN_FREE_BYTES else "low"

    @classmethod
    def has_free_space(cls, path, minimum=MIN_FREE_BYTES):
        free = cls.free_bytes(path)
        # Kapasitas tak diketahui = gagal tertutup, jangan tulis berkas besar.
        return free is not None and free >= minimum

    @classmethod
    def get_health(cls, app):
        from sqlalchemy import text
        from app.models import db
        from app.services.backup.backup_service import default_db_path
        from app.utils.scheduler_tasks import get_last_runs

        try:
            db.session.execute(text("SELECT 1"))
            db_status = "ok"
        except Exception:
            try:
                db.session.rollback()
            except Exception:
                pass
            db_status = "down"

        disk = cls.disk_status(os.path.dirname(default_db_path(app)))
        last_backup = get_last_runs().get("database_backup")
        backup = "unknown" if not last_backup else ("ok" if last_backup["ok"] else "failed")
        checks = {"db": db_status, "disk": disk, "backup": backup}
        healthy = all(value in ("ok", "unknown") for value in checks.values())
        return {"status": "ok" if healthy else "degraded", "checks": checks}
