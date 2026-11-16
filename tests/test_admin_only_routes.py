import pytest
from app import create_app
from app.models import db, Grup, User


@pytest.fixture
def client():
    app = create_app({"TESTING": True, "WTF_CSRF_ENABLED": False,
                      "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler", keterangan="Reguler", warna="#888888")
        db.session.add(grup); db.session.commit()
        kasir = User(username="kasir1", nama_lengkap="Kasir", role="kasir", aktif=True)
        kasir.set_password("kasir123")
        db.session.add(kasir)
        db.session.commit()
    c = app.test_client()
    c.post("/api/v1/kasir/auth/login", json={"username": "kasir1", "password": "kasir123"})
    return c


def test_kasir_tidak_bisa_hapus_audit_blackout(client):
    res = client.post("/api/v1/kasir/blackout/clear", json={"date": "2026-01-01"})
    assert res.status_code == 403


def test_kasir_tidak_bisa_hentikan_lhm(client, monkeypatch):
    from app.routes.server_monitor import monitor_routes as sm
    monkeypatch.setattr(sm.subprocess, "run", lambda *a, **k: None)
    assert client.post("/api/v1/kasir/server-monitor/lhm/stop").status_code == 403
