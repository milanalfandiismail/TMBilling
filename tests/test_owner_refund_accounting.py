import datetime as dt
import pytest
from app import create_app, db
from app.models import User, Paket, Transaksi, Grup
from app.services.owner.analytics_service import OwnerAnalyticsService


@pytest.fixture
def ctx():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        user = User(username="kasir_owner", nama_lengkap="Kasir", role="kasir")
        user.set_password("pass123")
        grup = Grup(nama="reguler", keterangan="Reguler", warna="#888888")
        db.session.add(grup)
        db.session.commit()
        paket = Paket(nama="Paket 1 Jam", durasi_menit=60, harga=20000, aktif=True, grup_id=grup.id)
        db.session.add_all([user, paket])
        db.session.commit()
        base = dt.datetime(2026, 1, 1, 10, 0)
        db.session.add_all([
            Transaksi(no_nota="TM-20260101-001", jenis="beli_paket_guest", jumlah=50000,
                      menit=60, paket_id=paket.id, user_id=user.id,
                      is_refunded=True, dibuat_pada=base),
            Transaksi(no_nota="TM-20260101-002", jenis="refund_paket", jumlah=-50000,
                      menit=0, paket_id=paket.id, user_id=user.id,
                      is_refunded=False, dibuat_pada=base),
            Transaksi(no_nota="TM-20260101-003", jenis="beli_paket_guest", jumlah=20000,
                      menit=60, paket_id=paket.id, user_id=user.id,
                      is_refunded=False, dibuat_pada=base),
        ])
        db.session.commit()
        yield app, base


def test_pendapatan_mengabaikan_transaksi_refund(ctx):
    _, base = ctx
    end = base + dt.timedelta(hours=1)

    harian = OwnerAnalyticsService.get_pendapatan_harian(base, end)
    per_kasir = OwnerAnalyticsService.get_pendapatan_per_kasir(base, end)

    assert sum(harian["billing"]) == 20000
    assert sum(per_kasir["data"]) == 20000
