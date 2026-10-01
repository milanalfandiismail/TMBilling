# tests/test_afk_model_and_migration.py
import pytest
from app import create_app, db
from app.models import PC, Sesi, Member, Grup, now_local
from sqlalchemy import inspect, text

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

def test_sesi_afk_fields_and_dict_serialization(app_context):
    grup = Grup(nama="reguler", warna="#888888")
    db.session.add(grup)
    db.session.commit()

    pc = PC(kode="PC01", nama="PC 01", grup_id=grup.id)
    db.session.add(pc)
    db.session.commit()

    sesi = Sesi(
        tipe="guest",
        pc_id=pc.id,
        nama_guest="Guest01",
        durasi_beli_menit=60,
        status="aktif",
        is_afk=True,
        afk_pin="hashed_pin_1234",
        afk_sejak=now_local()
    )
    db.session.add(sesi)
    db.session.commit()

    # Verifikasi field dan serialisasi
    sesi_dict = sesi.to_dict()
    assert sesi_dict["is_afk"] is True
    assert sesi_dict["afk_sejak"] is not None

    pc_dict = pc.to_dict()
    assert pc_dict.get("is_afk") is True

def test_self_healing_auto_migration_for_afk_columns(app_context):
    inspector = inspect(db.engine)
    cols = [c["name"] for c in inspector.get_columns("sesi")]
    assert "is_afk" in cols
    assert "afk_pin" in cols
    assert "afk_sejak" in cols
    assert "sesi_asal_id" in cols
