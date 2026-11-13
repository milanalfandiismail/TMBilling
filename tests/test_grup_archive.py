import pytest

from app import create_app
from app.models import db, Grup, User
from app.services.grup.grup_service import GrupService


@pytest.fixture
def ctx():
    app = create_app({"TESTING": True, "WTF_CSRF_ENABLED": False,
                      "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


def test_archive_lalu_restore_grup(ctx):
    grup = GrupService.create({"nama": "zona-uji", "warna": "#111111"})

    GrupService.archive(grup.id)
    assert db.session.get(Grup, grup.id).aktif is False
    assert grup not in GrupService.get_all()

    GrupService.restore(grup.id)
    assert db.session.get(Grup, grup.id).aktif is True
    assert grup in GrupService.get_all()


def test_restore_grup_yang_tidak_diarsip_ditolak(ctx):
    grup = GrupService.create({"nama": "zona-aktif"})
    with pytest.raises(ValueError, match="tidak dalam arsip"):
        GrupService.restore(grup.id)


def test_route_arsip_dan_restore_grup(ctx):
    grup = GrupService.create({"nama": "zona-route"})
    admin = User(username="admin_arsip", password_hash="x", role="admin", aktif=True)
    db.session.add(admin)
    db.session.commit()

    client = ctx.test_client()
    with client.session_transaction() as s:
        s["kasir_id"] = admin.id
        s["kasir_username"] = admin.username
        s["kasir_role"] = "admin"

    res = client.post(f"/api/v1/kasir/grup/{grup.id}/archive")
    assert res.status_code == 200
    assert db.session.get(Grup, grup.id).aktif is False

    res = client.post(f"/api/v1/kasir/grup/{grup.id}/restore")
    assert res.status_code == 200
    assert db.session.get(Grup, grup.id).aktif is True

    res = client.post("/api/v1/kasir/grup/999999/restore")
    assert res.status_code == 400
