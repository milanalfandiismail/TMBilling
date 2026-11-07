import os, sqlite3
import pytest
from app import create_app
from app.models import db, Settings
from app.services.settings.db_maintenance_service import DBMaintenanceService


def test_arsip_pra_purge_memuat_baris_di_wal(tmp_path, monkeypatch):
    monkeypatch.setenv("BACKUP_DIR", str(tmp_path / "backups"))
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path/'live.db'}"})
    with app.app_context():
        db.create_all()
        db.session.add(Settings(key="penanda_purge", value="ada"))
        db.session.commit()
        DBMaintenanceService.purge_and_vacuum(1)

        archive = tmp_path / "backups" / "archive"
        files = sorted(archive.glob("warnet_pre_purge_*.db"))
        assert files, "arsip pra-purge tidak dibuat"
        con = sqlite3.connect(files[-1])
        try:
            assert con.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
            assert con.execute("SELECT value FROM settings WHERE key='penanda_purge'").fetchone()[0] == "ada"
        finally:
            con.close()
