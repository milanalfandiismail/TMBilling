from datetime import datetime

import pytest

from app import create_app, db
from app.models import Transaksi
from app.repositories import TransaksiRepository


@pytest.fixture
def ctx():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        db.session.add_all([
            Transaksi(no_nota="TM-001", jenis="beli_paket_guest", jumlah=20000,
                      metode_pembayaran="Tunai", dibuat_pada=datetime(2026, 1, 1, 10, 0)),
            Transaksi(no_nota="TM-002", jenis="refund_paket", jumlah=-20000,
                      metode_pembayaran="Tunai", dibuat_pada=datetime(2026, 1, 1, 11, 0)),
        ])
        db.session.commit()
        yield app


def test_refund_tidak_menambah_jumlah_transaksi(ctx):
    with ctx.app_context():
        breakdown = TransaksiRepository.get_breakdown_metode_by_tanggal("2026-01-01")

        assert breakdown["Tunai"]["count"] == 1
        assert breakdown["Tunai"]["total"] == 0
