import threading
from types import SimpleNamespace

import pytest

from app import create_app
from app.models import db, User
from app.routes.mikrotik import mikrotik_routes
from app.services.member.member_service import MemberService


class FakeConfig:
    enabled = True
    host = "10.0.0.1"
    port = 8728
    username = "admin"
    password = "rahasia"
    hotspot_profile = "default"


class FakeThread:
    def __init__(self, target, args=(), daemon=None):
        self._target = target
        self._args = args

    def start(self):
        self._target(*self._args)


@pytest.fixture()
def app(tmp_path):
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///" + str(tmp_path / "mikrotik.db"),
        "WTF_CSRF_ENABLED": False,
    })
    with app.app_context():
        db.create_all()
        admin_user = User(username="mikro_admin", role="admin", aktif=True)
        admin_user.set_password("rahasia")
        db.session.add(admin_user)
        db.session.commit()
    return app


@pytest.fixture()
def client(app, monkeypatch):
    monkeypatch.setattr(mikrotik_routes.MikroTikConfig, "get_instance", staticmethod(lambda: FakeConfig()))
    monkeypatch.setattr(
        MemberService,
        "get_all",
        staticmethod(lambda: [SimpleNamespace(username="m1"), SimpleNamespace(username="m2"), SimpleNamespace(username="m3")]),
    )
    monkeypatch.setattr(mikrotik_routes.threading, "Thread", FakeThread)
    test_client = app.test_client()
    with test_client.session_transaction() as sess:
        sess["kasir_id"] = 1
        sess["kasir_role"] = "admin"
        sess["kasir_username"] = "mikro_admin"
    return test_client


def test_sync_all_rejects_overlap(client):
    with mikrotik_routes._sync_lock:
        res = client.post("/api/v1/kasir/mikrotik/sync_all")
    assert res.status_code == 409
    assert "sedang berjalan" in res.get_json()["error"].lower()


def test_sync_all_counts_false_and_exception_as_failures(client, monkeypatch):
    kelas = type("FakeClient", (), {})
    kelas.test_connection = lambda self: (True, "ok")
    kelas.login = lambda self: True
    kelas.close = lambda self: None
    kelas.add_user = lambda self, user, password, profile: (user == "m1")
    monkeypatch.setattr(mikrotik_routes, "MikroTikAPIClient", lambda *a: kelas())
    logs = []
    monkeypatch.setattr(mikrotik_routes, "write_log", lambda *a, **k: logs.append(a))

    res = client.post("/api/v1/kasir/mikrotik/sync_all")

    assert res.status_code == 200
    assert any("1 berhasil, 2 gagal" in str(x[1]) for x in logs)
    assert mikrotik_routes._sync_lock.acquire(blocking=False)
    mikrotik_routes._sync_lock.release()


def test_sync_all_releases_lock_after_worker_error(client, monkeypatch):
    kelas = type("FakeClient", (), {})
    kelas.test_connection = lambda self: (True, "ok")
    def gagal_login(self):
        raise RuntimeError("putus")
    kelas.login = gagal_login
    kelas.close = lambda self: None
    monkeypatch.setattr(mikrotik_routes, "MikroTikAPIClient", lambda *a: kelas())
    logs = []
    monkeypatch.setattr(mikrotik_routes, "write_log", lambda *a, **k: logs.append(a))

    res = client.post("/api/v1/kasir/mikrotik/sync_all")

    assert res.status_code == 200
    assert any("MIKROTIK_ERROR" == x[0] for x in logs)
    assert mikrotik_routes._sync_lock.acquire(blocking=False)
    mikrotik_routes._sync_lock.release()


def test_connection_failure_releases_lock(client, monkeypatch):
    kelas = type("FakeClient", (), {})
    kelas.test_connection = lambda self: (False, "timeout")
    monkeypatch.setattr(mikrotik_routes, "MikroTikAPIClient", lambda *a: kelas())

    res = client.post("/api/v1/kasir/mikrotik/sync_all")

    assert res.status_code == 400
    assert mikrotik_routes._sync_lock.acquire(blocking=False)
    mikrotik_routes._sync_lock.release()
