import pytest

from app import create_app
from app.models import db
from app.utils import scheduler_tasks

KEY = "uji-kunci-flush"


@pytest.fixture
def app(tmp_path):
    application = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "CLIENT_API_KEY": KEY,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///" + (tmp_path / "warnet.db").as_posix(),
        "INSTANCE_PATH": str(tmp_path / "instance"),
    })
    with application.app_context():
        db.create_all()
    return application


def test_tanpa_api_key_ditolak(app):
    res = app.test_client().post("/api/v1/kasir/settings/uptime/flush")
    assert res.status_code == 401


def test_dari_luar_loopback_ditolak(app):
    res = app.test_client().post(
        "/api/v1/kasir/settings/uptime/flush",
        headers={"X-Client-Key": KEY},
        environ_base={"REMOTE_ADDR": "10.20.30.40"},
    )
    assert res.status_code == 403


def test_loopback_dengan_api_key_memflush(app, monkeypatch):
    dipanggil = []
    monkeypatch.setattr(scheduler_tasks, "run_flush_uptime", lambda a: dipanggil.append(a))

    res = app.test_client().post(
        "/api/v1/kasir/settings/uptime/flush",
        headers={"X-Client-Key": KEY},
        environ_base={"REMOTE_ADDR": "127.0.0.1"},
    )

    assert res.status_code == 200
    assert dipanggil == [app]

