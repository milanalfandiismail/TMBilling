"""Satu transaksi hanya boleh direfund sekali walau dua request bersamaan."""

import threading
from pathlib import Path

import pytest

from app import create_app, db
from app.models import Transaksi
from app.repositories.transaksi.transaksi_repository import TransaksiRepository


@pytest.fixture()
def app_trx(tmp_path):
    uri = "sqlite:///" + str(tmp_path / "refund.db").replace("\\", "/")
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": uri,
    })
    with app.app_context():
        db.create_all()
        trx = Transaksi(
            no_nota="TMM-TEST-0001",
            jenis="beli_paket",
            jumlah=10000,
            metode_pembayaran="Tunai",
            user_id=None,
            is_refunded=False,
        )
        db.session.add(trx)
        db.session.commit()
        trx_id = trx.id
        db.session.remove()
        yield app, trx_id
        db.session.remove()
        db.engine.dispose()


def test_claim_refund_hanya_sekali_menang(app_trx):
    app, trx_id = app_trx
    hasil = []
    kunci = threading.Lock()
    mulai = threading.Barrier(2)

    def klaim():
        with app.app_context():
            mulai.wait()
            menang = TransaksiRepository.claim_refund(trx_id)
            db.session.commit()
            db.session.remove()
        with kunci:
            hasil.append(menang)

    threads = [threading.Thread(target=klaim) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    with app.app_context():
        assert sorted(hasil) == [False, True]
        assert db.session.get(Transaksi, trx_id).is_refunded is True
