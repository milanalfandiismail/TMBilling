import pytest

from app import create_app, db
from app.models import User


@pytest.fixture
def app_ctx():
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
    })
    with app.app_context():
        db.create_all()
        admin = User(username="admin_tut2", nama_lengkap="Admin", role="admin")
        admin.set_password("pass123")
        db.session.add(admin)
        db.session.commit()
        admin_id = admin.id
    yield app, admin_id


def _login(client, user_id):
    with client.session_transaction() as sess:
        sess["kasir_id"] = user_id
        sess["kasir_username"] = "admin_tut2"
        sess["kasir_role"] = "admin"


def test_judul_pendek_dibalas_400_bukan_500(app_ctx):
    app, admin_id = app_ctx
    client = app.test_client()
    _login(client, admin_id)

    resp = client.post("/api/v1/kasir/tutorials/", json={"title": "x", "content": "isi"})

    assert resp.status_code == 400
    assert "minimal 3 karakter" in resp.get_json()["error"]
