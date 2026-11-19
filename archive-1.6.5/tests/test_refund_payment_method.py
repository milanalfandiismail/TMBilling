# tests/test_refund_payment_method.py
"""Unit test untuk verifikasi konsistensi metode pembayaran saat refund paket (Guest & Member)."""

import pytest
from app import create_app
from app.models import db, User, Grup, PC, Paket, Member, Sesi, Transaksi, ShiftRecord, now_local
from app.services.sesi.sesi_service import SesiService
from app.services.member.member_service import MemberService
from app.services.shift.shift_service import ShiftService


@pytest.fixture
def app_context():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.create_all()
        kasir = User(username="kasir_test", nama_lengkap="Kasir Test", role="kasir")
        kasir.set_password("kasir123")
        db.session.add(kasir)

        grup = Grup(nama="Reguler", keterangan="Reguler Zone", warna="#888888")
        db.session.add(grup)
        db.session.commit()

        pc = PC(kode="TM-01", nama="PC 01", grup_id=grup.id)
        paket = Paket(nama="Paket 2 Jam QRIS", durasi_menit=120, harga=20000, grup_id=grup.id, aktif=True)
        db.session.add_all([pc, paket])
        db.session.commit()

        yield app
        db.session.remove()
        db.drop_all()


def test_refund_guest_paket_preserves_qris_payment_method(app_context):
    """Pastikan refund paket guest yang dibayar QRIS mencatat metode pembayaran QRIS."""
    kasir = User.query.filter_by(username="kasir_test").first()
    pc = PC.query.filter_by(kode="TM-01").first()
    paket = Paket.query.first()

    # Buka shift kasir
    shift = ShiftService.start_shift("kasir_test", modal_awal=50000, operator="admin")

    # Buka sesi guest dengan QRIS
    sesi = SesiService.buka_guest("TM-01", paket.id, nama_guest="Guest QRIS", operator="kasir_test", metode_pembayaran="QRIS")
    
    # Ambil transaksi asli
    transaksi_beli = Transaksi.query.filter_by(sesi_id=sesi.id, jenis="beli_paket_guest").first()
    assert transaksi_beli is not None
    assert transaksi_beli.metode_pembayaran == "QRIS"
    assert transaksi_beli.jumlah == 20000

    # Lakukan refund paket
    refund_res = SesiService.refund_paket_guest(sesi.id, transaksi_beli.id, operator="kasir_test")
    assert refund_res["durasi_dikurangi"] == 120

    # Ambil transaksi refund
    transaksi_refund = Transaksi.query.filter_by(sesi_id=sesi.id, jenis="refund_paket").first()
    assert transaksi_refund is not None
    # METODE HARUS QRIS! Bukan Tunai!
    assert transaksi_refund.metode_pembayaran == "QRIS"
    assert transaksi_refund.jumlah == -20000

    # Cek ringkasan shift kasir:
    # Modal awal 50.000. Karena pembayaran awal QRIS dan di-refund via QRIS:
    # Uang fisik di laci harus TETAP 50.000 (TIDAK BOLEH berkurang karena QRIS)
    summary = ShiftService.get_shift_summary(shift.id)
    assert summary["modal_awal"] == 50000
    assert summary["total_seharusnya"] == 50000
    assert summary["breakdown"]["Tunai"] == 0
    assert summary["breakdown"]["QRIS"] == 0
    assert summary["total_billing"] == 0
    assert summary["total_refund"] == 20000


def test_refund_member_paket_preserves_transfer_payment_method(app_context):
    """Pastikan refund paket member yang dibayar Transfer mencatat metode pembayaran Transfer."""
    kasir = User.query.filter_by(username="kasir_test").first()
    grup = Grup.query.first()
    paket = Paket.query.first()

    member = Member(username="member_transfer", nama_lengkap="Member Transfer", no_hp="081299998888", grup_id=grup.id)
    member.set_password("pass123")
    db.session.add(member)
    db.session.commit()

    # Tambah waktu member dengan Transfer
    tambah_res = MemberService.tambah_waktu(member.id, paket, operator="kasir_test", metode_pembayaran="Transfer")
    assert member.waktu_tersimpan == 120

    transaksi_beli = Transaksi.query.filter_by(member_id=member.id, jenis="beli_paket_member").first()
    assert transaksi_beli is not None
    assert transaksi_beli.metode_pembayaran == "Transfer"

    # Lakukan refund
    refund_res = MemberService.refund_paket(member.id, transaksi_beli.id, operator="kasir_test")
    assert member.waktu_tersimpan == 0

    transaksi_refund = Transaksi.query.filter_by(member_id=member.id, jenis="refund_paket").first()
    assert transaksi_refund is not None
    # METODE HARUS Transfer!
    assert transaksi_refund.metode_pembayaran == "Transfer"
    assert transaksi_refund.jumlah == -20000
