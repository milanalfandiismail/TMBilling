# tests/test_kasir_client_session.py

import pytest
from app import create_app, db
from app.models import User, PC, Grup, Sesi, now_local
from app.services.auth.auth_service import AuthService
from app.services.sesi.sesi_service import SesiService

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

def test_kasir_client_login_success(app_ctx):
    # Setup grup dan PC
    grup_vip = Grup(nama="VIP", warna="#FF5500")
    db.session.add(grup_vip)
    db.session.flush()

    pc = PC(kode="VIP-01", grup_id=grup_vip.id, ip_address="192.168.1.101", mac_address="AA:BB:CC:DD:EE:01")
    kasir = User(
        username="kasir_dimas",
        nama_lengkap="Dimas Anggara",
        role="kasir",
        kuota_main_bulanan=3600,
        sisa_kuota_menit=3600
    )
    kasir.set_password("dimas123")
    db.session.add_all([pc, kasir])
    db.session.commit()

    # Login client sebagai kasir
    res = AuthService.login("kasir_dimas", "dimas123", "192.168.1.101", "AA:BB:CC:DD:EE:01")
    assert res["success"] is True
    assert res["tipe"] == "kasir"
    assert res["waktu_tersimpan"] == 3600
    assert "[Kasir]" in res["nama"]

    # Pastikan sesi aktif di database bertipe 'kasir'
    sesi = Sesi.query.filter_by(user_id=kasir.id, status="aktif").first()
    assert sesi is not None
    assert sesi.tipe == "kasir"
    assert sesi.pc_id == pc.id

def test_kasir_client_login_fails_if_no_quota(app_ctx):
    grup = Grup(nama="Reguler", warna="#0055FF")
    db.session.add(grup)
    db.session.flush()

    pc = PC(kode="PC-02", grup_id=grup.id, ip_address="192.168.1.102", mac_address="AA:BB:CC:DD:EE:02")
    kasir = User(
        username="kasir_habis",
        role="kasir",
        kuota_main_bulanan=0,
        sisa_kuota_menit=0
    )
    kasir.set_password("pass123")
    db.session.add_all([pc, kasir])
    db.session.commit()

    with pytest.raises(ValueError, match="Kuota bermain kasir"):
        AuthService.login("kasir_habis", "pass123", "192.168.1.102", "AA:BB:CC:DD:EE:02")

def test_kasir_client_login_prevents_multi_login(app_ctx):
    grup = Grup(nama="Reguler", warna="#0055FF")
    db.session.add(grup)
    db.session.flush()

    pc1 = PC(kode="PC-01", grup_id=grup.id, ip_address="192.168.1.101", mac_address="AA:BB:CC:DD:EE:01")
    pc2 = PC(kode="PC-02", grup_id=grup.id, ip_address="192.168.1.102", mac_address="AA:BB:CC:DD:EE:02")
    kasir = User(username="kasir_ganda", role="kasir", kuota_main_bulanan=600, sisa_kuota_menit=600)
    kasir.set_password("pass123")
    db.session.add_all([pc1, pc2, kasir])
    db.session.commit()

    # Login di PC 1 berhasil
    AuthService.login("kasir_ganda", "pass123", "192.168.1.101", "AA:BB:CC:DD:EE:01")

    # Login di PC 2 harus ditolak
    with pytest.raises(ValueError, match="sedang bermain di PC PC-01"):
        AuthService.login("kasir_ganda", "pass123", "192.168.1.102", "AA:BB:CC:DD:EE:02")

def test_kasir_session_tutup_sesi_syncs_quota(app_ctx):
    grup = Grup(nama="Reguler", warna="#0055FF")
    db.session.add(grup)
    db.session.flush()

    pc = PC(kode="PC-03", grup_id=grup.id, ip_address="192.168.1.103", mac_address="AA:BB:CC:DD:EE:03")
    kasir = User(username="kasir_sync", role="kasir", kuota_main_bulanan=120, sisa_kuota_menit=120)
    kasir.set_password("pass123")
    db.session.add_all([pc, kasir])
    db.session.commit()

    login_res = AuthService.login("kasir_sync", "pass123", "192.168.1.103", "AA:BB:CC:DD:EE:03")
    sesi_id = login_res["sesi_id"]

    # Tutup sesi kasir
    SesiService.tutup_sesi(sesi_id, operator="admin")

    saved_user = User.query.get(kasir.id)
    assert saved_user.sisa_kuota_menit <= 120
    saved_sesi = Sesi.query.get(sesi_id)
    assert saved_sesi.status == "selesai"
