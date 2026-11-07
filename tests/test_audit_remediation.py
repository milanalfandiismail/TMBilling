# tests/test_audit_remediation.py
"""Regresi remediasi audit: refund penuh, ringkasan shift, nota, XSS, throttle, index sesi."""
import uuid
from datetime import timedelta

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app import create_app
from app.models import db, User, Grup, PC, Paket, Member, Sesi, Transaksi, now_local
from app.services.auth import login_throttle
from app.services.member.member_service import MemberService
from app.services.sesi.sesi_service import SesiService
from app.services.shift.shift_service import ShiftService
from app.services.transaksi.transaksi_service import TransaksiService
from app.utils.helpers import sanitize_html


@pytest.fixture
def ctx():
    """Fixture terisolasi: nama unik per test agar aman pada DB test yang persisten."""
    suffix = uuid.uuid4().hex[:8]
    app = create_app()
    app.config["TESTING"] = True
    with app.app_context():
        db.create_all()
        # Bersihkan sisa state global yang mengganggu isolasi pada DB test persisten
        from app.models import ShiftRecord
        ShiftRecord.query.filter_by(status="AKTIF").update({"status": "SELESAI"})
        hari_ini = now_local().strftime("%Y%m%d")
        Transaksi.query.filter(Transaksi.no_nota.like(f"TM-{hari_ini}-%")).delete(synchronize_session=False)
        db.session.commit()

        kasir_a = User(username=f"kasir_a_{suffix}", nama_lengkap="Kasir A", role="kasir")
        kasir_a.set_password("x")
        kasir_b = User(username=f"kasir_b_{suffix}", nama_lengkap="Kasir B", role="kasir")
        kasir_b.set_password("x")
        grup = Grup(nama=f"grup_{suffix}", keterangan="Reg", warna="#888")
        db.session.add_all([kasir_a, kasir_b, grup])
        db.session.commit()

        pc = PC(kode=f"PC-{suffix}", nama="PC Uji", grup_id=grup.id)
        paket = Paket(nama=f"Paket60-{suffix}", durasi_menit=60, harga=12000,
                      grup_id=grup.id, aktif=True)
        member = Member(username=f"member_{suffix}", nama_lengkap="Member Uji",
                        grup_id=grup.id, password_hash="x", waktu_tersimpan=10, aktif=True)
        db.session.add_all([pc, paket, member])
        db.session.commit()

        yield {
            "app": app, "kasir_a": kasir_a, "kasir_b": kasir_b,
            "pc": pc, "paket": paket, "member": member,
        }
        db.session.remove()
        db.drop_all()


def test_refund_guest_refunds_full_transaction_amount(ctx):
    sesi = SesiService.buka_guest(ctx["pc"].kode, ctx["paket"].id, nama_guest="G1")
    transaksi = Transaksi.query.filter_by(sesi_id=sesi.id, jenis="beli_paket_guest").first()

    sesi.mulai_pada = now_local() - timedelta(minutes=45)  # sisa 15 dari 60 menit
    db.session.commit()

    hasil = SesiService.refund_paket_guest(sesi.id, transaksi.id)
    refund = Transaksi.query.filter_by(sesi_id=sesi.id, jenis="refund_paket").first()

    assert hasil["durasi_dikurangi"] == 15
    assert refund.jumlah == -12000  # refund penuh harga paket
    assert refund.menit == -15


def test_refund_member_refunds_full_transaction_amount(ctx):
    member = ctx["member"]
    transaksi = Transaksi(
        member_id=member.id, paket_id=ctx["paket"].id, jenis="beli_paket_member",
        jumlah=12000, menit=60, no_nota=f"TM-T-{uuid.uuid4().hex[:8]}",
        metode_pembayaran="Tunai",
    )
    db.session.add(transaksi)
    db.session.commit()

    MemberService.refund_paket(member.id, transaksi.id)
    refund = Transaksi.query.filter_by(member_id=member.id, jenis="refund_paket").first()

    assert refund.menit == -60
    assert refund.jumlah == -12000  # refund penuh harga paket
    assert Member.query.get(member.id).waktu_tersimpan == 0


def test_shift_summary_counts_transactions_of_other_cashiers(ctx):
    shift = ShiftService.start_shift(ctx["kasir_a"].username, modal_awal=0, operator="admin")
    db.session.add(Transaksi(
        jenis="beli_paket_guest", jumlah=5000, no_nota=f"TM-S-{uuid.uuid4().hex[:8]}",
        user_id=ctx["kasir_b"].id, dibuat_pada=now_local(),
    ))
    db.session.commit()

    assert ShiftService.get_shift_summary(shift.id)["total_billing"] == 5000


def test_shift_summary_does_not_clamp_negative_net(ctx):
    shift = ShiftService.start_shift(ctx["kasir_a"].username, modal_awal=0, operator="admin")
    db.session.add(Transaksi(
        jenis="refund_paket", jumlah=-7000, no_nota=f"TM-R-{uuid.uuid4().hex[:8]}",
        metode_pembayaran="Tunai", dibuat_pada=now_local(),
    ))
    db.session.commit()

    assert ShiftService.get_shift_summary(shift.id)["total_billing"] == -7000


def test_nota_sequence_uses_highest_existing_number(ctx):
    hari_ini = now_local().strftime("%Y%m%d")
    for nomor in (2, 5):  # sengaja bolong, bukan berurutan
        db.session.add(Transaksi(
            jenis="beli_paket_guest", jumlah=1000,
            no_nota=f"TM-{hari_ini}-{nomor:03d}", dibuat_pada=now_local(),
        ))
    db.session.commit()

    assert TransaksiService.generate_nota() == f"TM-{hari_ini}-006"


@pytest.mark.parametrize("payload", [
    '<a href="javascript:alert(1)">x</a>',
    '<a href="java\tscript:alert(1)">x</a>',
    '<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>',
    '<img src="vbscript:msgbox(1)">',
    '<a href="https://ok.example">ok</a>',
])
def test_sanitize_html_blocks_dangerous_protocols(payload):
    hasil = sanitize_html(payload)
    assert "javascript:" not in hasil.replace("\t", "")
    assert "data:text/html" not in hasil
    assert "vbscript:" not in hasil


def test_login_throttle_blocks_after_five_failures(ctx):
    key = (f"10.0.0.{uuid.uuid4().int % 250}", "kasir")
    login_throttle.clear(key)
    for _ in range(login_throttle.MAX_FAILURES):
        assert login_throttle.is_blocked(key) is False
        login_throttle.record_failure(key)

    assert login_throttle.is_blocked(key) is True
    login_throttle.clear(key)
    assert login_throttle.is_blocked(key) is False


def test_unique_index_blocks_second_active_session_per_pc(ctx):
    pc = ctx["pc"]
    db.session.execute(text(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_aktif_sesi_pc "
        "ON sesi (pc_id) WHERE status = 'aktif' AND pc_id IS NOT NULL"
    ))
    db.session.add(Sesi(tipe="guest", pc_id=pc.id, status="aktif", nama_guest="A",
                        durasi_beli_menit=60, mulai_pada=now_local()))
    db.session.commit()

    db.session.add(Sesi(tipe="guest", pc_id=pc.id, status="aktif", nama_guest="B",
                        durasi_beli_menit=60, mulai_pada=now_local()))
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()
