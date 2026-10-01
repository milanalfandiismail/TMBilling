import pytest
from app import create_app, db
from app.models import Member, Paket, Grup, PC, Sesi
from app.services.member.member_service import MemberService
from app.services.sesi.sesi_service import SesiService


@pytest.fixture
def db_session():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"

    with app.app_context():
        db.create_all()

        grup = Grup(nama="grup_paket_test", warna="#334455")
        db.session.add(grup)
        db.session.flush()

        member = Member(
            username="test_member_pkg",
            nama_lengkap="Member Paket",
            grup_id=grup.id,
            waktu_tersimpan=0,
        )
        member.set_password("pass123")

        paket = Paket(
            nama="Paket Gaming 2 Jam",
            durasi_menit=120,
            harga=10000,
            kadaluarsa_hari=7,
            grup_id=grup.id,
            aktif=True,
        )

        pc = PC(kode="PC-TEST-01", grup_id=grup.id, ip_address="192.168.1.50")

        db.session.add_all([member, paket, pc])
        db.session.commit()

        yield app, member.id, paket.id, pc.id

        db.session.remove()
        db.drop_all()


def test_member_tambah_waktu_rejects_out_of_bound_qty(db_session):
    app, member_id, paket_id, _ = db_session

    with app.app_context():
        paket = Paket.query.get(paket_id)

        # Test qty 0 (kurang dari 1)
        with pytest.raises(ValueError, match="1 sampai 100"):
            MemberService.tambah_waktu(member_id, paket, qty=0)

        # Test qty negatif
        with pytest.raises(ValueError, match="1 sampai 100"):
            MemberService.tambah_waktu(member_id, paket, qty=-5)

        # Test qty lebih dari batas maksimal 100 (mencegah DoS / overflow)
        with pytest.raises(ValueError, match="1 sampai 100"):
            MemberService.tambah_waktu(member_id, paket, qty=101)


def test_member_tambah_waktu_calculates_mathematically(db_session):
    app, member_id, paket_id, _ = db_session

    with app.app_context():
        paket = Paket.query.get(paket_id)
        # Beli 3 paket @ 120 menit = 360 menit
        updated_member = MemberService.tambah_waktu(member_id, paket, qty=3)
        assert updated_member.waktu_tersimpan == 360
        assert updated_member.kadaluarsa_pada is not None


def test_sesi_tambah_waktu_rejects_out_of_bound_qty(db_session):
    app, member_id, paket_id, pc_id = db_session

    with app.app_context():
        paket = Paket.query.get(paket_id)

        # Buka sesi guest
        sesi = SesiService.buka_guest(
            pc_kode="PC-TEST-01",
            paket_id=paket_id,
            nama_guest="Guest Test",
        )

        # Coba tambah waktu dengan qty 0
        with pytest.raises(ValueError, match="1 sampai 100"):
            SesiService.tambah_waktu_sesi(sesi.id, paket, qty=0)

        # Coba tambah waktu dengan qty 150
        with pytest.raises(ValueError, match="1 sampai 100"):
            SesiService.tambah_waktu_sesi(sesi.id, paket, qty=150)


def test_payment_method_validations(db_session):
    app, member_id, paket_id, pc_id = db_session

    with app.app_context():
        paket = Paket.query.get(paket_id)

        # Invalid payment method in buka_guest
        with pytest.raises(ValueError, match="Metode pembayaran tidak valid"):
            SesiService.buka_guest(
                pc_kode="PC-TEST-01",
                paket_id=paket_id,
                metode_pembayaran="E-Wallet"
            )

        # Valid payment method with case insensitivity in buka_guest
        sesi = SesiService.buka_guest(
            pc_kode="PC-TEST-01",
            paket_id=paket_id,
            metode_pembayaran="qris"
        )
        assert sesi.tipe == "guest"

        # Invalid payment method in tambah_waktu_sesi
        with pytest.raises(ValueError, match="Metode pembayaran tidak valid"):
            SesiService.tambah_waktu_sesi(
                sesi.id,
                paket,
                metode_pembayaran="Kredit"
            )

        # Invalid payment method in member tambah_waktu
        with pytest.raises(ValueError, match="Metode pembayaran tidak valid"):
            MemberService.tambah_waktu(
                member_id,
                paket,
                metode_pembayaran="PayLater"
            )

