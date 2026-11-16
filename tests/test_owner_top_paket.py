import datetime as dt
import pytest
from sqlalchemy import text
from app import create_app
from app.models import db, Grup, Paket, Transaksi


@pytest.fixture
def ctx():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler", keterangan="Reguler", warna="#888888")
        db.session.add(grup); db.session.commit()
        paket = Paket(nama="Paket 1 Jam", durasi_menit=60, harga=12000, grup_id=grup.id, aktif=True)
        db.session.add(paket); db.session.commit()
        for i in range(3):
            db.session.add(Transaksi(paket_id=paket.id, jenis="beli_paket", jumlah=12000, menit=60,
                                     no_nota=f"TM-20260101-{i}", metode_pembayaran="Tunai"))
        db.session.commit()
        db.session.execute(text("DELETE FROM paket WHERE id=:i"), {"i": paket.id})
        db.session.commit()
        yield app


def test_paket_terhapus_masuk_lainnya(ctx):
    from app.services.owner.analytics_service import OwnerAnalyticsService
    with ctx.app_context():
        res = OwnerAnalyticsService.get_top_paket(dt.datetime(2020, 1, 1), dt.datetime(2030, 1, 1))
        assert sum(res["data"]) == 3
        assert any("hapus" in label.lower() for label in res["labels"])
