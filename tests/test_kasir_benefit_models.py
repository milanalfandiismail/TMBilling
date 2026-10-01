# tests/test_kasir_benefit_models.py

import pytest
from app import create_app, db
from app.models import User, Sesi, PC, Grup, ShiftRecord
from datetime import datetime

@pytest.fixture
def app_ctx():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

def test_user_benefit_fields_and_methods(app_ctx):
    kasir = User(username="kasir_test", role="kasir")
    kasir.set_password("kasir123")
    kasir.kuota_main_bulanan = 7200  # 120 jam
    kasir.sisa_kuota_menit = 7200
    kasir.terakhir_reset_kuota = "2026-08"
    db.session.add(kasir)
    db.session.commit()

    # Test auto reset bulanan
    reset_terjadi = kasir.cek_dan_reset_kuota_bulanan()
    assert reset_terjadi is True
    assert kasir.sisa_kuota_menit == 7200
    assert kasir.terakhir_reset_kuota == datetime.now().strftime("%Y-%m")

    # Test tambah bonus jam
    kasir.tambah_kuota_bonus(300)  # +5 jam
    assert kasir.sisa_kuota_menit == 7500
    assert kasir.kuota_main_bulanan == 7200  # kuota dasar tetap

def test_sesi_kasir_fields_and_calculations(app_ctx):
    grup = Grup(nama="Grup1", warna="#112233")
    db.session.add(grup)
    db.session.flush()
    pc = PC(kode="PC-01", grup_id=grup.id)
    kasir = User(username="kasir_sesi", role="kasir", kuota_main_bulanan=600, sisa_kuota_menit=600)
    kasir.set_password("kasir123")
    db.session.add_all([pc, kasir])
    db.session.commit()

    sesi = Sesi(
        tipe="kasir",
        user_id=kasir.id,
        pc_id=pc.id,
        status="aktif",
        waktu_tersimpan_awal=kasir.sisa_kuota_menit
    )
    db.session.add(sesi)
    db.session.commit()

    assert sesi.tipe == "kasir"
    assert sesi.user_id == kasir.id
    assert sesi.sisa_menit() == 600

def test_shift_record_catatan_and_qris_fields(app_ctx):
    kasir = User(username="kasir_shift", role="kasir")
    kasir.set_password("pass123")
    db.session.add(kasir)
    db.session.commit()

    shift = ShiftRecord(
        kasir_id=kasir.id,
        modal_awal=50000,
        catatan="Serah terima lancar",
        total_qris=150000,
        total_refund=0
    )
    db.session.add(shift)
    db.session.commit()

    saved = ShiftRecord.query.get(shift.id)
    assert saved.catatan == "Serah terima lancar"
    assert saved.total_qris == 150000
    assert saved.total_refund == 0

def test_backward_compatibility_old_database_defaults(app_ctx):
    # Simulasi user dan shift lama yang kolom barunya kosong
    user_lama = User(username="kasir_lama", role="kasir")
    user_lama.set_password("pass123")
    db.session.add(user_lama)
    db.session.commit()

    assert user_lama.kuota_main_bulanan in (0, None)
    assert user_lama.sisa_kuota_menit in (0, None)
    # Tidak boleh crash saat to_dict()
    d = user_lama.to_dict()
    assert "kuota_main_bulanan" in d
    assert "sisa_kuota_menit" in d
