"""Karakterisasi pencatatan status job backup: tepat satu record_run per eksekusi."""

import pytest

from app import create_app
from app.utils import scheduler_tasks


class _FakeBackup:
    gagal_cloud = False

    def __init__(self, db_path=None, backup_dir=None):
        pass

    def create_backup(self, report=None):
        if _FakeBackup.gagal_cloud:
            report["failed"] = ["gcs"]

    def cleanup_old_backups(self, max_keep=5):
        pass


@pytest.fixture
def app_ctx():
    app = create_app({"TESTING": True, "WTF_CSRF_ENABLED": False,
                      "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        yield app


def _jalankan(app, monkeypatch, gagal_cloud):
    # BackupService & helper path diimpor DI DALAM fungsi, jadi patch modul asalnya.
    import app.services as services_pkg
    from app.services.backup import backup_service

    tercatat = []
    monkeypatch.setattr(services_pkg, "BackupService", _FakeBackup)
    monkeypatch.setattr(backup_service, "default_db_path", lambda app: "warnet.db")
    monkeypatch.setattr(backup_service, "default_backup_dir", lambda app: "backups")
    monkeypatch.setattr(scheduler_tasks, "record_run",
                        lambda job_id, ok, skipped=False: tercatat.append((job_id, ok)))
    monkeypatch.setattr(scheduler_tasks.os.path, "exists", lambda p: True)
    monkeypatch.setattr(scheduler_tasks, "write_log", lambda *a, **k: None)
    _FakeBackup.gagal_cloud = gagal_cloud
    scheduler_tasks.run_database_backup(app)
    return tercatat


def test_backup_sukses_tercatat_sekali(app_ctx, monkeypatch):
    assert _jalankan(app_ctx, monkeypatch, False) == [("database_backup", True)]


def test_backup_cloud_gagal_tercatat_gagal(app_ctx, monkeypatch):
    assert _jalankan(app_ctx, monkeypatch, True) == [("database_backup", False)]
