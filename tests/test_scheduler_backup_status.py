from app import create_app
from app.utils import scheduler_tasks


def _app(tmp_path):
    return create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///" + (tmp_path / "warnet.db").as_posix(),
        "INSTANCE_PATH": str(tmp_path / "instance"),
        "BACKUP_DIR": str(tmp_path / "backups"),
    })


def _patch_backup(monkeypatch, uploaded, failed):
    def fake_create_backup(self, report=None):
        report["uploaded"] = list(uploaded)
        report["failed"] = list(failed)
        return "dummy.zip"

    monkeypatch.setattr(
        "app.services.backup.backup_service.BackupService.create_backup",
        fake_create_backup,
    )


def test_backup_cloud_gagal_ditandai_gagal(tmp_path, monkeypatch):
    app = _app(tmp_path)
    with app.app_context():
        scheduler_tasks._LAST_RUN.clear()
        _patch_backup(monkeypatch, ["NAS"], ["Discord Webhook"])
        scheduler_tasks.run_database_backup(app)
        assert scheduler_tasks.get_last_runs()["database_backup"]["ok"] is False


def test_backup_tanpa_provider_dianggap_berhasil(tmp_path, monkeypatch):
    app = _app(tmp_path)
    with app.app_context():
        scheduler_tasks._LAST_RUN.clear()
        _patch_backup(monkeypatch, [], [])
        scheduler_tasks.run_database_backup(app)
        assert scheduler_tasks.get_last_runs()["database_backup"]["ok"] is True
