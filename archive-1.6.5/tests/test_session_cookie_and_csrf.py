import pytest

from app import create_app
from app.models import User, db


@pytest.fixture
def app(tmp_path):
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path/'csrf.db'}",
        "WTF_CSRF_ENABLED": False,
    })
    with app.app_context():
        db.create_all()
        u = User(username="admin1", role="admin", aktif=True)
        u.set_password("rahasia")
        db.session.add(u)
        db.session.commit()
    return app


def test_flag_cookie_dan_csrf_admin(app, monkeypatch):
    assert app.config["SESSION_COOKIE_HTTPONLY"] is True
    assert app.config["SESSION_COOKIE_SAMESITE"] == "Lax"
    monkeypatch.setattr(
        "app.routes.server_monitor.monitor_routes.subprocess.run",
        lambda *a, **k: None,
    )
    c = app.test_client()
    assert c.post(
        "/api/v1/kasir/auth/login",
        json={"username": "admin1", "password": "rahasia"},
    ).status_code == 200
    app.config["WTF_CSRF_ENABLED"] = True
    res = c.post("/api/v1/kasir/server-monitor/lhm/stop")
    assert res.status_code == 400
