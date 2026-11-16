import pytest

from app import create_app, db
from app.models import Grup, PC
from app.services.client.client_service import ClientService


@pytest.fixture
def app_ctx(tmp_path):
    db_path = (tmp_path / "client_fallback.db").as_posix()
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{db_path}",
    })
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.commit()
        db.session.add_all([
            PC(kode="PC-01", nama="PC 01", ip_address="10.10.0.1", grup_id=grup.id,
               mac_address="AA:BB:CC:DD:EE:01", aktif=False),
            PC(kode="PC-02", nama="PC 02", ip_address="10.10.0.2", grup_id=grup.id,
               mac_address="AA:BB:CC:DD:EE:02", aktif=True),
        ])
        db.session.commit()
    yield app
    with app.app_context():
        db.session.remove()
        db.drop_all()


def test_pc_arsip_tidak_dikenali_via_fallback_mac(app_ctx):
    with app_ctx.app_context():
        hasil = ClientService.get_status("10.99.0.1", "AA:BB:CC:DD:EE:01")

    assert hasil["status"] == "kosong"
    assert hasil["message"] == "PC tidak dikenal"


def test_pc_aktif_tetap_dikenali_via_fallback_mac(app_ctx):
    with app_ctx.app_context():
        hasil = ClientService.get_status("10.99.0.2", "AA:BB:CC:DD:EE:02")

    assert hasil.get("pc_kode") == "PC-02"
    assert "message" not in hasil
