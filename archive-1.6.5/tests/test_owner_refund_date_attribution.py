import datetime as dt

import pytest

from app import create_app, db
from app.models import Grup, Paket, Transaksi, User
from app.services.owner.analytics_service import OwnerAnalyticsService


@pytest.fixture
def ctx():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        user = User(username="kasir_lintas", nama_lengkap="Kasir Lintas", role="kasir")
        user.set_password("pass123")
        grup = Grup(nama="reguler", keterangan="Reguler", warna="#888888")
        db.session.add(grup)
        db.session.commit()
        paket = Paket(nama="Paket 1 Jam", durasi_menit=60, harga=20000, aktif=True, grup_id=grup.id)
        db.session.add_all([user, paket])
        db.session.commit()
        db.session.add_all([
            Transaksi(no_nota="TM-20260101-900", jenis="beli_paket_guest", jumlah=50000,
                      menit=60, paket_id=paket.id, user_id=user.id,
                      is_refunded=True, dibuat_pada=dt.datetime(2026, 1, 1, 3, 0)),
            Transaksi(no_nota="TM-20260102-901", jenis="refund_paket", jumlah=-50000,
                      menit=0, paket_id=paket.id, user_id=user.id,
                      is_refunded=False, dibuat_pada=dt.datetime(2026, 1, 2, 3, 0)),
        ])
        db.session.commit()
        yield


def test_refund_mengurangi_tanggal_refund(ctx):
    harian = OwnerAnalyticsService.get_pendapatan_harian(dt.datetime(2026, 1, 1), dt.datetime(2026, 1, 3))
    per_kasir = OwnerAnalyticsService.get_pendapatan_per_kasir(dt.datetime(2026, 1, 1), dt.datetime(2026, 1, 3))

    per_hari = dict(zip(harian["labels"], harian["billing"]))
    assert per_hari["01/01/2026"] == 50000
    assert per_hari["02/01/2026"] == -50000
    assert sum(harian["billing"]) == 0
    assert per_kasir["data"] == [0]
