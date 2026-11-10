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
        admin = User(username="admin_analytics", nama_lengkap="Admin", role="admin")
        admin.set_password("pass123")
        db.session.add(admin)
        db.session.commit()
        yield app, admin


def _login(client, user):
    with client.session_transaction() as sess:
        sess["kasir_id"] = user.id
        sess["kasir_username"] = user.username
        sess["kasir_role"] = user.role


def test_start_invalid_400(ctx):
    app, admin = ctx
    client = app.test_client()
    _login(client, admin)

    resp = client.get("/api/v1/kasir/dashboard/analytics?start=abc")

    assert resp.status_code == 400


def test_tanpa_parameter_tetap_200(ctx):
    app, admin = ctx
    client = app.test_client()
    _login(client, admin)

    assert client.get("/api/v1/kasir/dashboard/analytics").status_code == 200
