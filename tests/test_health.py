"""Test health endpoint, guard disk, dan status scheduler."""

import collections

import pytest

from app import create_app
from app.models import db, User
from app.services.health.health_service import HealthService


@pytest.fixture
def health_env(tmp_path):
    db_file = tmp_path / "health_test.db"
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{db_file.as_posix()}",
    })
    with app.app_context():
        admin = User(username="admin_health_test", password_hash="x", role="admin", aktif=True)
        kasir = User(username="kasir_health_test", password_hash="x", role="kasir", aktif=True)
        db.session.add_all([admin, kasir])
        db.session.commit()
        yield app, admin.id, kasir.id
        db.session.remove()
        db.engine.dispose()


Usage = collections.namedtuple("usage", "total used free")


def test_health_endpoint_public_ok(health_env):
    app, _admin_id, _kasir_id = health_env
    from app.utils.scheduler_tasks import _LAST_RUN
    _LAST_RUN.pop("database_backup", None)

    res = app.test_client().get("/api/health")
    assert res.status_code == 200
    body = res.get_json()
    assert body["status"] == "ok"
    assert set(body["checks"]) == {"db", "disk", "backup"}
    assert body["checks"]["db"] == "ok"
    assert body["checks"]["backup"] == "unknown"


def test_health_reports_low_disk(health_env, monkeypatch):
    app, _admin_id, _kasir_id = health_env
    import app.services.health.health_service as health_module
    monkeypatch.setattr(health_module.shutil, "disk_usage", lambda _p: Usage(10, 9, 1024))

    body = app.test_client().get("/api/health").get_json()
    assert body["checks"]["disk"] == "low"
    assert body["status"] == "degraded"


def test_health_route_falls_back_when_service_raises(health_env, monkeypatch):
    app, _admin_id, _kasir_id = health_env
    monkeypatch.setattr(
        HealthService,
        "get_health",
        classmethod(lambda cls, _app: (_ for _ in ()).throw(RuntimeError("boom"))),
    )

    res = app.test_client().get("/api/health")
    assert res.status_code == 200
    assert res.get_json() == {"status": "degraded", "checks": {"db": "down"}}


def test_backup_refuses_when_disk_low(health_env, tmp_path, monkeypatch):
    app, _admin_id, _kasir_id = health_env
    backup_dir = tmp_path / "low_disk_backups"
    from app.services.backup.backup_service import BackupService
    monkeypatch.setattr(HealthService, "free_bytes", staticmethod(lambda _p: 1024))

    with app.app_context():
        with pytest.raises(RuntimeError, match="Ruang disk backup tidak cukup"):
            BackupService(backup_dir=str(backup_dir)).create_backup()

    assert list(backup_dir.iterdir()) == []


def test_auto_screenshot_skips_on_low_disk(health_env, monkeypatch):
    app, _admin_id, _kasir_id = health_env
    from app.services import ClientService, SettingsService
    from app.repositories import SesiRepository
    from app.utils.scheduler_tasks import run_auto_screenshots

    class _Sesi:
        pc_id = 1

    queued = []
    monkeypatch.setattr(SesiRepository, "get_all_aktif", staticmethod(lambda: [_Sesi()]))
    monkeypatch.setattr(ClientService, "queue_command", classmethod(lambda cls, *a: queued.append(a)))
    monkeypatch.setattr(HealthService, "free_bytes", staticmethod(lambda _p: 1024))

    with app.app_context():
        SettingsService.set("screenshot_auto_enabled", "1")
        run_auto_screenshots(app)

    assert queued == []


def _login(client, user_id, role, username):
    with client.session_transaction() as session:
        session["kasir_id"] = user_id
        session["kasir_role"] = role
        session["kasir_username"] = username


def test_scheduler_status_admin_only_and_records(health_env):
    app, admin_id, kasir_id = health_env
    from app.utils.scheduler_tasks import get_last_runs, record_run

    client = app.test_client()
    _login(client, kasir_id, "kasir", "kasir_health_test")
    assert client.get("/api/v1/kasir/settings/scheduler/status").status_code == 403

    _login(client, admin_id, "admin", "admin_health_test")
    with app.app_context():
        record_run("flush_uptime", True)
    res = client.get("/api/v1/kasir/settings/scheduler/status")
    assert res.status_code == 200
    assert res.get_json()["last_runs"]["flush_uptime"]["ok"] is True
    assert "at" in get_last_runs()["flush_uptime"]
