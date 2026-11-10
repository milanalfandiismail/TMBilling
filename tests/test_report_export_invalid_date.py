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
        admin = User(username="admin_export", nama_lengkap="Admin", role="admin")
        admin.set_password("pass123")
        db.session.add(admin)
        db.session.commit()
        yield app, admin


@pytest.mark.parametrize("endpoint", ["billing", "kantin", "pnl"])
def test_export_tanggal_invalid_400(ctx, endpoint):
    app, admin = ctx
    client = app.test_client()
    with client.session_transaction() as sess:
        sess["kasir_id"] = admin.id
        sess["kasir_username"] = admin.username
        sess["kasir_role"] = admin.role

    resp = client.get(f"/api/v1/kasir/report/export/{endpoint}?tanggal=abc")

    assert resp.status_code == 400
    assert "tanggal" in resp.get_json()["error"].lower() or "format" in resp.get_json()["error"].lower()
