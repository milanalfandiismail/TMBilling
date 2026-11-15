"""Pesan error screenshot tidak boleh membocorkan detail internal ke client."""

import pytest

from app import create_app
from app.models import db, PC, Grup, User
from app.routes.monitor import screenshot_routes


@pytest.fixture
def client():
    app = create_app({"TESTING": True, "WTF_CSRF_ENABLED": False,
                      "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        db.session.add(Grup(nama="reguler", keterangan="Reguler", warna="#888888"))
        db.session.commit()
        admin = User(username="admin1", nama_lengkap="Admin", role="admin", aktif=True)
        admin.set_password("admin123")
        pc = PC(kode="PC-01", ip_address="10.0.0.1", grup_id=1, aktif=True)
        db.session.add_all([admin, pc])
        db.session.commit()
    c = app.test_client()
    c.post("/api/v1/kasir/auth/login", json={"username": "admin1", "password": "admin123"})
    return c


def test_status_error_tidak_membocorkan_pesan_internal(client, monkeypatch):
    def _boom():
        raise RuntimeError("BOOM-INTERNAL-PATH")

    tercatat = []
    monkeypatch.setattr(screenshot_routes, "_upload_folder", _boom)
    monkeypatch.setattr(screenshot_routes, "write_log", lambda ev, msg, **kw: tercatat.append(msg))

    res = client.get("/api/v1/kasir/monitor/screenshot/status/1")

    assert res.status_code == 500
    assert "BOOM-INTERNAL-PATH" not in res.get_data(as_text=True)
    assert any("BOOM-INTERNAL-PATH" in msg for msg in tercatat), "detail harus tetap masuk log server"
