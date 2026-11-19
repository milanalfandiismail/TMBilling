import datetime as dt

import pytest

from app import create_app, db
from app.models import User, Paket, Transaksi, Grup
from app.repositories.transaksi.transaksi_repository import TransaksiRepository
from app.services.report.report_service import ReportService


@pytest.fixture
def ctx():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        user = User(username="kasir_refund", nama_lengkap="Kasir", role="kasir")
        user.set_password("pass123")
        grup = Grup(nama="reguler", keterangan="Reguler", warna="#888888")
        db.session.add(grup)
        db.session.commit()
        paket = Paket(nama="Paket 1 Jam", durasi_menit=60, harga=20000, aktif=True, grup_id=grup.id)
        db.session.add_all([user, paket])
        db.session.commit()
        base = dt.datetime(2026, 1, 1, 10, 0)
        db.session.add_all([
            Transaksi(no_nota="TM-20260101-001", jenis="beli_paket_guest", jumlah=200000,
                      menit=60, paket_id=paket.id, user_id=user.id,
                      metode_pembayaran="QRIS", dibuat_pada=base),
            Transaksi(no_nota="TM-20260101-002", jenis="refund_paket", jumlah=-20000,
                      menit=0, paket_id=paket.id, user_id=user.id,
                      metode_pembayaran="QRIS", dibuat_pada=base),
            Transaksi(no_nota="TM-20260101-003", jenis="beli_paket_guest", jumlah=50000,
                      menit=60, paket_id=paket.id, user_id=user.id,
                      metode_pembayaran="Tunai", dibuat_pada=base),
        ])
        db.session.commit()
        yield base


def test_breakdown_metode_memisahkan_refund(ctx):
    breakdown = TransaksiRepository.get_breakdown_metode_by_tanggal("2026-01-01")

    assert breakdown["QRIS"]["gross"] == 200000
    assert breakdown["QRIS"]["refund_count"] == 1
    assert breakdown["QRIS"]["refund"] == 20000
    assert breakdown["QRIS"]["total"] == 180000
    assert breakdown["QRIS"]["count"] == 1
    assert breakdown["Tunai"]["refund"] == 0


def test_total_chip_sama_dengan_pendapatan_billing(ctx):
    laporan = ReportService.get_laporan_by_tanggal("2026-01-01")
    total_chip = sum(d["total"] for d in laporan["breakdown_metode"].values())

    assert total_chip == laporan["total_pendapatan_billing"] == 230000
    assert laporan["total_refund"] == 20000
