import pytest
from app import create_app, db
from app.models import User


@pytest.fixture
def ctx():
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
    })
    with app.app_context():
        db.create_all()
        admin = User(username="admin_limit", nama_lengkap="Admin", role="admin")
        admin.set_password("pass123")
        db.session.add(admin)
        db.session.commit()
        yield app, admin


def test_limit_tiket_invalid_400(ctx):
    app, admin = ctx
    client = app.test_client()
    with client.session_transaction() as sess:
        sess["kasir_id"] = admin.id
        sess["kasir_username"] = admin.username
        sess["kasir_role"] = admin.role

    assert client.get("/api/v1/kasir/maintenance/list?limit=-1").status_code == 400
    assert client.get("/api/v1/kasir/maintenance/list?limit=0").status_code == 400
