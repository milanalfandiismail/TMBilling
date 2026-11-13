import pytest
from app import create_app
from app.models import db, Grup, PC, User


@pytest.fixture
def app():
    app = create_app({"TESTING": True, "WTF_CSRF_ENABLED": False,
                      "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler", keterangan="Reguler", warna="#888888")
        db.session.add(grup)
        db.session.commit()
        db.session.add(PC(kode="PC-01", nama="PC 01", ip_address="10.0.0.1",
                          grup_id=grup.id, aktif=True))
        for username, role in (("kasir", "kasir"), ("admin_uji", "admin")):
            user = User(username=username, nama_lengkap=username, role=role, aktif=True)
            user.set_password("rahasia123")
            db.session.add(user)
        db.session.commit()
    return app


def _login(client, role):
    return client.post("/api/v1/kasir/auth/login",
                       json={"username": role, "password": "rahasia123"})


def _payload(prioritas="KRITIS"):
    return {"pc_id": 1, "kategori": "HARDWARE", "prioritas": prioritas,
            "judul": "PC mati total"}


def test_kasir_tidak_bisa_membuat_tiket_kritis(app):
    client = app.test_client()
    _login(client, "kasir")
    res = client.post("/api/v1/kasir/maintenance/create", json=_payload())
    assert res.status_code == 403
    with app.app_context():
        assert db.session.get(PC, 1).aktif is True


def test_admin_bisa_membuat_tiket_kritis(app):
    client = app.test_client()
    _login(client, "admin_uji")
    res = client.post("/api/v1/kasir/maintenance/create", json=_payload())
    assert res.status_code == 201
    with app.app_context():
        assert db.session.get(PC, 1).aktif is False
