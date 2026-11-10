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
        admin = User(username="admin_maint", nama_lengkap="Admin", role="admin")
        admin.set_password("pass123")
        db.session.add(admin)
        db.session.commit()
        yield app, admin


def test_tanggal_laporan_maintenance_invalid_400(ctx):
    app, admin = ctx
    client = app.test_client()
    with client.session_transaction() as sess:
        sess["kasir_id"] = admin.id
        sess["kasir_username"] = admin.username
        sess["kasir_role"] = admin.role

    resp = client.get("/api/v1/kasir/maintenance/report?start_date=abc&end_date=abc")

    assert resp.status_code == 400
