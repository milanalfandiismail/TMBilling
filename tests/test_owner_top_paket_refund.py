import datetime as dt
import pytest
from app import create_app, db
from app.models import Paket, Transaksi, Grup
from app.services.owner.analytics_service import OwnerAnalyticsService


@pytest.fixture
def ctx():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler", keterangan="Reguler", warna="#888888")
        db.session.add(grup)
        db.session.commit()
        paket = Paket(nama="Paket 1 Jam", durasi_menit=60, harga=20000, aktif=True, grup_id=grup.id)
        db.session.add(paket)
        db.session.commit()
        base = dt.datetime(2026, 1, 1, 10, 0)
        db.session.add_all([
            Transaksi(no_nota="TM-20260101-001", jenis="beli_paket_guest", jumlah=50000,
                      menit=60, paket_id=paket.id, is_refunded=True, dibuat_pada=base),
            Transaksi(no_nota="TM-20260101-002", jenis="refund_paket", jumlah=-50000,
                      menit=0, paket_id=paket.id, is_refunded=False, dibuat_pada=base),
            Transaksi(no_nota="TM-20260101-003", jenis="beli_paket_guest", jumlah=20000,
                      menit=60, paket_id=paket.id, is_refunded=False, dibuat_pada=base),
        ])
        db.session.commit()
        yield base


def test_top_paket_dan_refund_rate_memakai_pembelian(ctx):
    base = ctx
    end = base + dt.timedelta(hours=1)

    top = OwnerAnalyticsService.get_top_paket(base, end)
    rate = OwnerAnalyticsService.get_refund_rate(base, end)

    assert top["data"] == [1]
    assert rate == {"total": 2, "refund": 1, "refund_rate": 50.0}


def test_non_package_transactions_do_not_change_package_analytics(ctx):
    base = ctx
    end = base + dt.timedelta(hours=1)
    db.session.add_all([
        Transaksi(no_nota="TM-20260101-010", jenis="tutup_sesi", jumlah=0,
                  menit=0, paket_id=None, is_refunded=False, dibuat_pada=base),
        Transaksi(no_nota="TM-20260101-011", jenis="tutup_sesi", jumlah=0,
                  menit=0, paket_id=None, is_refunded=False, dibuat_pada=base),
        Transaksi(no_nota="TM-20260101-012", jenis="tutup_sesi", jumlah=0,
                  menit=0, paket_id=None, is_refunded=False, dibuat_pada=base),
        Transaksi(no_nota="TM-20260101-013", jenis="tutup_sesi", jumlah=0,
                  menit=0, paket_id=None, is_refunded=False, dibuat_pada=base),
        Transaksi(no_nota="TM-20260101-014", jenis="pindah_pc", jumlah=0,
                  menit=0, paket_id=None, is_refunded=False, dibuat_pada=base),
    ])
    db.session.commit()

    top = OwnerAnalyticsService.get_top_paket(base, end)
    rate = OwnerAnalyticsService.get_refund_rate(base, end)

    assert top["labels"] == ["Paket 1 Jam"]
    assert top["data"] == [1]
    assert rate == {"total": 2, "refund": 1, "refund_rate": 50.0}

    empty_start = end + dt.timedelta(days=1)
    assert OwnerAnalyticsService.get_top_paket(empty_start, empty_start)["data"] == []
    assert OwnerAnalyticsService.get_refund_rate(empty_start, empty_start) == {
        "total": 0, "refund": 0, "refund_rate": 0
    }
