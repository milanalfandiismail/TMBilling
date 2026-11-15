import threading

import pytest

from app import create_app
from app.services.backup import backup_service
from app.services.backup.backup_service import BackupService


class FakeThread:
    def __init__(self, target, daemon=None):
        self._target = target

    def start(self):
        self._target()


@pytest.fixture()
def app(tmp_path, monkeypatch):
    monkeypatch.setenv("BACKUP_DIR", str(tmp_path / "backups"))
    monkeypatch.setattr(backup_service.threading, "Thread", FakeThread)
    backup_service._MANUAL_STATUS.update(status="idle", filename=None, message="")
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///" + str(tmp_path / "backup.db"),
    })
    yield app
    backup_service._MANUAL_STATUS.update(status="idle", filename=None, message="")


def test_manual_backup_runs_once(app, monkeypatch):
    monkeypatch.setattr(BackupService, "create_backup", lambda self, report=None, manual=False: "/tmp/x.zip")
    monkeypatch.setattr(BackupService, "cleanup_old_backups", lambda self, max_keep=5: None)
    assert backup_service._MANUAL_LOCK.acquire(blocking=False)
    try:
        started, status = BackupService.start_manual(app, "admin")
    finally:
        backup_service._MANUAL_LOCK.release()
    assert started is False
    assert status["status"] == "running"


def test_cloud_failure_marks_partial(app, monkeypatch):
    def fake_create(self, report=None, manual=False):
        report["failed"] = ["Discord Webhook"]
        return "/tmp/partial.zip"
    monkeypatch.setattr(BackupService, "create_backup", fake_create)
    monkeypatch.setattr(BackupService, "cleanup_old_backups", lambda self, max_keep=5: None)

    started, status = BackupService.start_manual(app, "admin")

    assert started is True
    assert status["status"] == "partial"
    assert status["filename"] == "partial.zip"
    assert "Discord Webhook" in status["message"]


def test_worker_failure_releases_guard(app, monkeypatch):
    monkeypatch.setattr(
        BackupService,
        "create_backup",
        lambda self, report=None, manual=False: (_ for _ in ()).throw(RuntimeError("disk penuh")),
    )

    started, status = BackupService.start_manual(app, "admin")

    assert started is True
    assert status["status"] == "failed"
    assert backup_service._MANUAL_LOCK.acquire(blocking=False)
    backup_service._MANUAL_LOCK.release()
