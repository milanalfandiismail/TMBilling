import pytest
from app import create_app
from app.models import db, User
from app.services.auth import login_throttle


@pytest.fixture
def client():
    login_throttle._failures.clear()
    app = create_app({"TESTING": True, "WTF_CSRF_ENABLED": False,
                      "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        admin = User(username="admin1", nama_lengkap="Admin", role="admin", aktif=True)
        admin.set_password("rahasia123")
        db.session.add(admin)
        db.session.commit()
    return app.test_client()


def test_admin_check_dibatasi_setelah_lima_gagal(client):
    codes = [client.post("/api/v1/kasir/auth/admin-check",
                         json={"username": "admin1", "password": "salah"}).status_code
             for _ in range(6)]
    assert codes[:5] == [401] * 5
    assert codes[5] == 429


def test_member_login_tidak_membocorkan_username(client):
    res = client.post("/member/login", json={"username": "tidakada", "password": "x"})
    assert res.status_code == 401
    assert "tidak ditemukan" not in res.get_json()["error"].lower()
