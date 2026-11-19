import pytest

from app import create_app
from app.models import db, Grup, PC, User
from app.services.grup.grup_service import GrupService
from app.services.pc.pc_service import PCService


@pytest.fixture
def ctx():
    app = create_app({"TESTING": True, "WTF_CSRF_ENABLED": False,
                      "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


def test_arsip_api_mengelompokkan_semua_resource(ctx):
    admin = User(username="admin_arsip_api", password_hash="x", role="admin", aktif=True)
    db.session.add(admin)
    db.session.commit()

    grup = GrupService.create({"nama": "zona-api"})
    pc = PC(kode="PC-A1", nama="PC Arsip", grup_id=grup.id, aktif=False)
    db.session.add(pc)
    db.session.commit()

    client = ctx.test_client()
    with client.session_transaction() as s:
        s["kasir_id"] = admin.id
        s["kasir_username"] = admin.username
        s["kasir_role"] = "admin"

    resp = client.get("/api/v1/kasir/arsip/")
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert set(data) == {"grup", "pc", "paket", "member", "user", "game", "menu"}
    assert data["pc"][0]["kode"] == "PC-A1"
    assert all(item["aktif"] is False for item in data["pc"])

    GrupService.archive(grup.id)
    data = client.get("/api/v1/kasir/arsip/").get_json()["data"]
    assert data["grup"][0]["nama"] == "zona-api"

    PCService.restore(pc.id)
    data = client.get("/api/v1/kasir/arsip/").get_json()["data"]
    assert data["pc"] == []


def test_arsip_api_tanpa_login_ditolak(ctx):
    resp = ctx.test_client().get("/api/v1/kasir/arsip/")
    assert resp.status_code in (401, 302)
