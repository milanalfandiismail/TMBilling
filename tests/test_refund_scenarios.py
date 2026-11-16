# tests/test_refund_scenarios.py
"""Matriks skenario refund paket guest & member.

Fokus: nominal penuh (-jumlah), konsistensi durasi/saldo, masa aktif,
penolakan transaksi tidak valid, dan idempotensi refund.
"""
import uuid
from datetime import timedelta

import pytest

from app import create_app
from app.models import db, Grup, PC, Paket, Member, Sesi, Transaksi, now_local
from app.services.sesi.sesi_service import SesiService
from app.services.member.member_service import MemberService


@pytest.fixture
def ctx():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler", keterangan="Reguler", warna="#888888")
        db.session.add(grup)
        db.session.commit()

        paket = Paket(nama="Paket 1 Jam", durasi_menit=60, harga=12000,
                      grup_id=grup.id, aktif=True, kadaluarsa_hari=30)
        pcs = [PC(kode=f"PC0{i}", nama=f"PC 0{i}", grup_id=grup.id) for i in (1, 2, 3)]
        db.session.add_all([paket, *pcs])
        db.session.commit()

        yield {"grup": grup, "paket": paket, "pcs": pcs}

        db.session.remove()
        db.drop_all()


def _member(ctx, saldo, kadaluarsa_pada=None):
    member = Member(
        username=f"m_{uuid.uuid4().hex[:8]}", nama_lengkap="Member Uji",
        grup_id=ctx["grup"].id, password_hash="x",
        waktu_tersimpan=saldo, aktif=True, kadaluarsa_pada=kadaluarsa_pada,
    )
    db.session.add(member)
    db.session.commit()
    return member


def _transaksi(**kwargs):
    kwargs.setdefault("no_nota", f"TM-T-{uuid.uuid4().hex[:8]}")
    transaksi = Transaksi(**kwargs)
    db.session.add(transaksi)
    db.session.commit()
    return transaksi


def _refund_count(**filters):
    return Transaksi.query.filter_by(jenis="refund_paket", **filters).count()


# =========================================================================
# GUEST
# =========================================================================

def test_guest_refund_partial_play_refunds_full_money(ctx):
    sesi = SesiService.buka_guest(ctx["pcs"][0].kode, ctx["paket"].id, nama_guest="G1")
    transaksi = Transaksi.query.filter_by(sesi_id=sesi.id, jenis="beli_paket_guest").first()
    sesi.mulai_pada = now_local() - timedelta(minutes=45)
    db.session.commit()

    hasil = SesiService.refund_paket_guest(sesi.id, transaksi.id)

    refund = Transaksi.query.filter_by(sesi_id=sesi.id, jenis="refund_paket").one()
    assert hasil["durasi_dikurangi"] == 15
    assert hasil["durasi_beli_sesudah"] == 45
    assert refund.jumlah == -12000
    assert refund.menit == -15
    assert Sesi.query.get(sesi.id).sisa_menit() == 0


def test_guest_refund_when_time_exhausted_is_rejected(ctx):
    sesi = SesiService.buka_guest(ctx["pcs"][0].kode, ctx["paket"].id, nama_guest="G2")
    transaksi = Transaksi.query.filter_by(sesi_id=sesi.id, jenis="beli_paket_guest").first()
    sesi.mulai_pada = now_local() - timedelta(minutes=90)
    db.session.commit()

    with pytest.raises(ValueError, match="Sisa waktu guest sudah habis"):
        SesiService.refund_paket_guest(sesi.id, transaksi.id)

    assert _refund_count(sesi_id=sesi.id) == 0
    assert Sesi.query.get(sesi.id).durasi_beli_menit == 60


def test_guest_refund_zero_duration_transaction_is_rejected(ctx):
    sesi = SesiService.buka_guest(ctx["pcs"][0].kode, ctx["paket"].id, nama_guest="G3")
    transaksi = _transaksi(sesi_id=sesi.id, paket_id=None, jenis="beli_paket_guest",
                           jumlah=999, menit=0)

    with pytest.raises(ValueError, match="Durasi paket tidak valid"):
        SesiService.refund_paket_guest(sesi.id, transaksi.id)

    assert _refund_count(sesi_id=sesi.id) == 0


def test_guest_refund_transaction_from_another_session_is_rejected(ctx):
    sesi_a = SesiService.buka_guest(ctx["pcs"][0].kode, ctx["paket"].id, nama_guest="A")
    sesi_b = SesiService.buka_guest(ctx["pcs"][1].kode, ctx["paket"].id, nama_guest="B")
    transaksi_a = Transaksi.query.filter_by(sesi_id=sesi_a.id, jenis="beli_paket_guest").first()

    with pytest.raises(ValueError, match="Transaksi tidak valid atau sudah direfund"):
        SesiService.refund_paket_guest(sesi_b.id, transaksi_a.id)

    assert _refund_count(sesi_id=sesi_b.id) == 0


def test_guest_refund_twice_is_rejected(ctx):
    sesi = SesiService.buka_guest(ctx["pcs"][0].kode, ctx["paket"].id, nama_guest="G4")
    transaksi = Transaksi.query.filter_by(sesi_id=sesi.id, jenis="beli_paket_guest").first()
    SesiService.refund_paket_guest(sesi.id, transaksi.id)

    with pytest.raises(ValueError, match="sudah direfund"):
        SesiService.refund_paket_guest(sesi.id, transaksi.id)

    assert _refund_count(sesi_id=sesi.id) == 1


def test_guest_refund_keeps_total_bayar_non_negative(ctx):
    sesi = SesiService.buka_guest(ctx["pcs"][0].kode, ctx["paket"].id, nama_guest="G5")
    transaksi = Transaksi.query.filter_by(sesi_id=sesi.id, jenis="beli_paket_guest").first()
    sesi.total_bayar = 5000
    db.session.commit()

    SesiService.refund_paket_guest(sesi.id, transaksi.id)

    assert Sesi.query.get(sesi.id).total_bayar == 0


# =========================================================================
# MEMBER
# =========================================================================

def test_member_refund_partial_wallet_refunds_full_money(ctx):
    member = _member(ctx, saldo=30)
    transaksi = _transaksi(member_id=member.id, paket_id=ctx["paket"].id,
                           jenis="beli_paket_member", jumlah=12000, menit=60,
                           metode_pembayaran="Tunai")

    MemberService.refund_paket(member.id, transaksi.id)

    refund = Transaksi.query.filter_by(member_id=member.id, jenis="refund_paket").one()
    assert Member.query.get(member.id).waktu_tersimpan == 0
    assert refund.jumlah == -12000
    assert refund.menit == -60


def test_member_refund_keeps_remainder_balance(ctx):
    kadaluarsa = now_local() + timedelta(days=100)
    member = _member(ctx, saldo=200, kadaluarsa_pada=kadaluarsa)
    transaksi = _transaksi(member_id=member.id, paket_id=ctx["paket"].id,
                           jenis="beli_paket_member", jumlah=12000, menit=60,
                           metode_pembayaran="Tunai")

    MemberService.refund_paket(member.id, transaksi.id)

    member = Member.query.get(member.id)
    assert member.waktu_tersimpan == 140
    assert member.kadaluarsa_pada == kadaluarsa - timedelta(days=30)


def test_member_refund_package_without_expiry_keeps_date_unset(ctx):
    suffix = uuid.uuid4().hex[:8]
    paket = Paket(nama=f"PaketTanpaExp-{suffix}", durasi_menit=60, harga=12000,
                  grup_id=ctx["grup"].id, aktif=True, kadaluarsa_hari=0)
    db.session.add(paket)
    db.session.commit()
    member = _member(ctx, saldo=60)
    transaksi = _transaksi(member_id=member.id, paket_id=paket.id,
                           jenis="beli_paket_member", jumlah=12000, menit=60,
                           metode_pembayaran="Tunai")

    MemberService.refund_paket(member.id, transaksi.id)

    member = Member.query.get(member.id)
    assert member.waktu_tersimpan == 0
    assert member.kadaluarsa_pada is None


def test_member_refund_qty_two_reduces_expiry_twice(ctx):
    member = _member(ctx, saldo=180, kadaluarsa_pada=now_local() + timedelta(days=100))
    transaksi = _transaksi(member_id=member.id, paket_id=ctx["paket"].id,
                           jenis="beli_paket_member", jumlah=24000, menit=120,
                           metode_pembayaran="Tunai")

    MemberService.refund_paket(member.id, transaksi.id)

    member = Member.query.get(member.id)
    assert member.waktu_tersimpan == 60
    sisa_hari = (member.kadaluarsa_pada - now_local()).days
    assert 39 <= sisa_hari <= 40


def test_member_refund_other_member_transaction_is_rejected(ctx):
    member_a = _member(ctx, saldo=60)
    member_b = _member(ctx, saldo=60)
    transaksi = _transaksi(member_id=member_a.id, paket_id=ctx["paket"].id,
                           jenis="beli_paket_member", jumlah=12000, menit=60,
                           metode_pembayaran="Tunai")

    with pytest.raises(ValueError, match="Transaksi tidak valid atau sudah direfund"):
        MemberService.refund_paket(member_b.id, transaksi.id)

    assert Member.query.get(member_b.id).waktu_tersimpan == 60
    assert _refund_count(member_id=member_b.id) == 0


def test_member_refund_twice_is_rejected(ctx):
    member = _member(ctx, saldo=120)
    transaksi = _transaksi(member_id=member.id, paket_id=ctx["paket"].id,
                           jenis="beli_paket_member", jumlah=12000, menit=60,
                           metode_pembayaran="Tunai")
    MemberService.refund_paket(member.id, transaksi.id)

    with pytest.raises(ValueError, match="sudah direfund"):
        MemberService.refund_paket(member.id, transaksi.id)

    assert Member.query.get(member.id).waktu_tersimpan == 60
    assert _refund_count(member_id=member.id) == 1


def test_member_refund_syncs_active_session_time(ctx):
    member = _member(ctx, saldo=120)
    sesi = SesiService.buka_member(ctx["pcs"][0].kode, member.username)
    assert sesi.waktu_tersimpan_awal == 120
    transaksi = _transaksi(member_id=member.id, paket_id=ctx["paket"].id,
                           jenis="beli_paket_member", jumlah=12000, menit=60,
                           metode_pembayaran="Tunai")

    MemberService.refund_paket(member.id, transaksi.id)

    assert Sesi.query.get(sesi.id).waktu_tersimpan_awal == 60
    assert Member.query.get(member.id).waktu_tersimpan == 60


def test_guest_refund_after_session_closed_is_rejected(ctx):
    sesi = SesiService.buka_guest(ctx["pcs"][0].kode, ctx["paket"].id, nama_guest="G6")
    transaksi = Transaksi.query.filter_by(sesi_id=sesi.id, jenis="beli_paket_guest").first()
    SesiService.tutup_sesi(sesi.id, operator="kasir")

    with pytest.raises(ValueError, match="Sesi tidak aktif atau bukan tipe guest"):
        SesiService.refund_paket_guest(sesi.id, transaksi.id)

    assert _refund_count(sesi_id=sesi.id) == 0


def test_refund_unknown_transaction_is_rejected(ctx):
    sesi = SesiService.buka_guest(ctx["pcs"][0].kode, ctx["paket"].id, nama_guest="G7")
    member = _member(ctx, saldo=60)

    with pytest.raises(ValueError, match="Transaksi tidak valid atau sudah direfund"):
        SesiService.refund_paket_guest(sesi.id, 999999)
    with pytest.raises(ValueError, match="Transaksi tidak valid atau sudah direfund"):
        MemberService.refund_paket(member.id, 999999)
