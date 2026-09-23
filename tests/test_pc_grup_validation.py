# tests/test_pc_grup_validation.py
import pytest
from app import create_app
from app.models import db, Grup, PC
from app.services.grup.grup_service import GrupService
from app.services.pc.pc_service import PCService


@pytest.fixture
def app_context():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


def test_create_grup_valid(app_context):
    g = GrupService.create({"nama": "vip zone", "warna": "#E74C3C", "keterangan": "Ruang VIP"})
    assert g.nama == "vip zone"
    assert g.warna == "#E74C3C"


def test_create_grup_invalid_nama(app_context):
    with pytest.raises(ValueError, match="Nama grup minimal 2 karakter"):
        GrupService.create({"nama": "v"})

    with pytest.raises(ValueError, match="Nama grup maksimal 30 karakter"):
        GrupService.create({"nama": "g" * 31})

    with pytest.raises(ValueError, match="Nama grup hanya boleh berisi"):
        GrupService.create({"nama": "vip@zone!"})


def test_create_grup_invalid_hex_color(app_context):
    with pytest.raises(ValueError, match="Format warna hex tidak valid"):
        GrupService.create({"nama": "vip", "warna": "merah"})


def test_create_pc_valid(app_context):
    GrupService.create({"nama": "reguler"})
    pc = PCService.create({"kode": "PC01", "nama": "PC Gaming 01", "grup": "reguler"})
    assert pc.kode == "PC01"
    assert pc.nama == "PC Gaming 01"


def test_create_pc_invalid_kode(app_context):
    GrupService.create({"nama": "reguler"})
    with pytest.raises(ValueError, match="Kode PC maksimal 11 karakter"):
        PCService.create({"kode": "PC00000000001", "grup": "reguler"})

    with pytest.raises(ValueError, match="Kode PC hanya boleh berisi"):
        PCService.create({"kode": "PC 01!", "grup": "reguler"})
