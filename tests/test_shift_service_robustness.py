# tests/test_shift_service_robustness.py

import pytest
from datetime import timedelta
from app import create_app, db
from app.models import User, ShiftRecord, Transaksi, TransaksiMenu, now_local
from app.services.shift.shift_service import ShiftService

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

def test_shift_lifecycle_with_catatan_and_qris(app_ctx):
    kasir = User(username="kasir_budi", nama_lengkap="Budi Santoso", role="kasir")
    kasir.set_password("budi123")
    db.session.add(kasir)
    db.session.commit()

    # 1. Buka shift
    shift = ShiftService.start_shift("kasir_budi", modal_awal=100000, operator="admin")
    assert shift.status == "AKTIF"
    assert shift.modal_awal == 100000

    # 2. Buat transaksi tunai dan QRIS (gunakan now_local)
    t1 = Transaksi(
        user_id=kasir.id,
        jumlah=50000,
        metode_pembayaran="Tunai",
        jenis="paket_member",
        is_refunded=False,
        dibuat_pada=now_local()
    )
    t2 = Transaksi(
        user_id=kasir.id,
        jumlah=75000,
        metode_pembayaran="QRIS",
        jenis="paket_member",
        is_refunded=False,
        dibuat_pada=now_local()
    )
    db.session.add_all([t1, t2])
    db.session.commit()

    # 3. Ringkasan shift
    summary = ShiftService.get_shift_summary(shift.id)
    assert summary["modal_awal"] == 100000
    assert summary["total_billing"] == 125000
    assert summary["breakdown"]["Tunai"] == 50000
    assert summary["breakdown"]["QRIS"] == 75000
    # Uang tunai yang seharusnya di laci = modal_awal (100k) + billing tunai (50k) = 150k
    assert summary["total_seharusnya"] == 150000

    # 4. Tutup shift dengan hitung buta dan catatan
    res = ShiftService.end_shift(shift.id, uang_fisik=145000, catatan="Kurang 5rb karena salah kembalian", operator="kasir_budi")
    assert res["status"] == "SELESAI"
    assert res["selisih"] == -5000
    assert res["catatan"] == "Kurang 5rb karena salah kembalian"

    saved = ShiftRecord.query.get(shift.id)
    assert saved.status == "SELESAI"
    assert saved.selisih == -5000
    assert saved.catatan == "Kurang 5rb karena salah kembalian"
    assert saved.total_qris == 75000

def test_closed_shift_summary_time_bounded(app_ctx):
    kasir = User(username="kasir_siti", nama_lengkap="Siti Aminah", role="kasir")
    kasir.set_password("siti123")
    db.session.add(kasir)
    db.session.commit()

    # Buka shift jam 8 jam lalu
    shift = ShiftService.start_shift("kasir_siti", modal_awal=50000)
    shift.waktu_mulai = now_local() - timedelta(hours=8)
    db.session.commit()

    # Transaksi selama shift
    t_inside = Transaksi(
        user_id=kasir.id,
        jumlah=30000,
        metode_pembayaran="Tunai",
        jenis="paket_member",
        is_refunded=False,
        dibuat_pada=now_local() - timedelta(hours=4)
    )
    db.session.add(t_inside)
    db.session.commit()

    # Tutup shift
    ShiftService.end_shift(shift.id, uang_fisik=80000, catatan="Pas")

    # Transaksi baru dibuat SETELAH shift tutup
    t_outside = Transaksi(
        user_id=kasir.id,
        jumlah=99000,
        metode_pembayaran="Tunai",
        jenis="paket_member",
        is_refunded=False,
        dibuat_pada=now_local() + timedelta(minutes=5)
    )
    db.session.add(t_outside)
    db.session.commit()

    # Periksa summary shift yang sudah selesai - transaksi t_outside TIDAK boleh masuk!
    summary = ShiftService.get_shift_summary(shift.id)
    assert summary["total_billing"] == 30000

def test_generate_shift_receipt_text(app_ctx):
    kasir = User(username="kasir_andi", nama_lengkap="Andi Pratama", role="kasir")
    kasir.set_password("andi123")
    db.session.add(kasir)
    db.session.commit()

    shift = ShiftService.start_shift("kasir_andi", modal_awal=50000)
    ShiftService.end_shift(shift.id, uang_fisik=50000, catatan="Aman")

    receipt = ShiftService.generate_shift_receipt_text(shift.id)
    assert "STRUK SERAH TERIMA SHIFT" in receipt
    assert "Andi Pratama" in receipt
    assert "Modal Awal" in receipt
    assert "Selisih" in receipt
