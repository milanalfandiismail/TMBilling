import pytest
from datetime import timedelta
from app import create_app, db
from app.models import now_local, Member, PC, Grup, Sesi
from app.services import ClientService, SesiService, AuthService
from app.repositories import MemberRepository, PCRepository, SesiRepository


@pytest.fixture
def client_app():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["CLIENT_API_KEY"] = "test-key-123"
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


def test_member_afk_expiry_depletes_balance_to_zero(client_app):
    """
    Test untuk memastikan bug 'kunci meja sisa 1 menit abadi' terselesaikan.
    Ketika member mengunci meja dan membiarkan waktu habis, saldo member harus
    menjadi 0 dan tidak stuck di 1 menit saat login kembali.
    """
    with client_app.app_context():
        # 1. Setup Grup, PC, Member
        grup = Grup(nama="Reguler", warna="#3b82f6")
        db.session.add(grup)
        db.session.commit()

        pc = PC(kode="PC-01", ip_address="192.168.1.101", mac_address="AA:BB:CC:DD:EE:01", grup_id=grup.id, aktif=True)
        db.session.add(pc)
        db.session.commit()

        member = Member(
            username="player1",
            grup_id=grup.id,
            waktu_tersimpan=1,  # Saldo 1 menit
            aktif=True
        )
        member.set_password("password123")
        db.session.add(member)
        db.session.commit()

        # 2. Member Login dari PC Client
        login_res = AuthService.login("player1", "password123", pc.ip_address, pc.mac_address)
        assert login_res["success"] is True

        sesi = SesiRepository.get_aktif_by_pc(pc.id)
        assert sesi is not None
        assert sesi.tipe == "member"
        assert sesi.waktu_tersimpan_awal == 1

        # 3. Kunci Meja (AFK Lock)
        lock_res = ClientService.afk_lock(pc.ip_address, pc.mac_address)
        assert lock_res["success"] is True
        assert sesi.is_afk is True
        assert sesi.afk_sejak is not None

        # 4. Simulasikan waktu berlalu 65 detik (waktu 1 menit sudah habis)
        sesi.waktu_mulai_sesi = now_local() - timedelta(seconds=65)
        db.session.commit()

        # 5. Jalankan SesiService.cleanup_expired (seperti yang dipanggil berkala oleh kasir / scheduler)
        cleaned = SesiService.cleanup_expired()
        assert cleaned == 1

        # 6. Verifikasi sesi berstatus selesai dan AFK flags di-reset
        saved_sesi = db.session.get(Sesi, sesi.id)
        assert saved_sesi.status == "selesai"
        assert saved_sesi.is_afk is False
        assert saved_sesi.afk_pin is None
        assert saved_sesi.afk_sejak is None

        # 7. Verifikasi saldo member di database sudah menjadi 0
        saved_member = MemberRepository.get_by_username("player1")
        assert saved_member.waktu_tersimpan == 0

        # 8. Verifikasi saat mencoba login kembali, ditolak karena waktu habis (bukan tersisa 1 menit terus)
        with pytest.raises(ValueError, match="Waktu habis"):
            AuthService.login("player1", "password123", pc.ip_address, pc.mac_address)


def test_member_afk_client_get_status_expiry_depletes_balance_to_zero(client_app):
    """
    Test ketika client polling get_status mendeteksi sisa waktu <= 0 saat AFK.
    """
    with client_app.app_context():
        grup = Grup(nama="VIP", warna="#eab308")
        db.session.add(grup)
        db.session.commit()

        pc = PC(kode="PC-02", ip_address="192.168.1.102", mac_address="AA:BB:CC:DD:EE:02", grup_id=grup.id, aktif=True)
        db.session.add(pc)
        db.session.commit()

        member = Member(
            username="vipuser",
            grup_id=grup.id,
            waktu_tersimpan=1,
            aktif=True
        )
        member.set_password("pass456")
        db.session.add(member)
        db.session.commit()

        # Login & Lock AFK
        AuthService.login("vipuser", "pass456", pc.ip_address, pc.mac_address)
        sesi = SesiRepository.get_aktif_by_pc(pc.id)
        ClientService.afk_lock(pc.ip_address, pc.mac_address)

        # Simulasikan waktu lewat 70 detik
        sesi.waktu_mulai_sesi = now_local() - timedelta(seconds=70)
        db.session.commit()

        # Client polling get_status
        status_res = ClientService.get_status(pc.ip_address, pc.mac_address)
        assert status_res["status"] == "kosong"
        assert status_res["message"] == "Waktu habis"

        # Verifikasi saldo member menjadi 0
        saved_member = MemberRepository.get_by_username("vipuser")
        assert saved_member.waktu_tersimpan == 0

        # Verifikasi sesi sudah tidak aktif
        assert SesiRepository.get_aktif_by_pc(pc.id) is None
