from datetime import datetime

import pytest

from app import create_app, db


@pytest.fixture()
def app():
    application = create_app({"TESTING": True, "WTF_CSRF_ENABLED": False,
                              "SQLALCHEMY_DATABASE_URI": "sqlite://"})
    with application.app_context():
        db.create_all()
        yield application
        db.session.remove()
        db.drop_all()


def test_tanggal_lokal_dihitung_dari_utc(app):
    from app.models import MenuItem, Sesi, Transaksi, TransaksiMenu
    from app.repositories.sesi.sesi_repository import SesiRepository

    menu = MenuItem(nama="Menu Uji")
    db.session.add_all([
        menu,
        Sesi(tipe="guest", mulai_pada=datetime(2025, 1, 1, 23, 30)),
        Transaksi(jenis="tutup_sesi", dibuat_pada=datetime(2025, 1, 1, 10, 0)),
        TransaksiMenu(no_nota="A", menu=menu, tanggal=datetime(2025, 1, 3, 1, 0)),
    ])
    db.session.commit()

    # mulai_pada ber-default now_local saat insert; NULL hanya bisa dipaksa lewat update
    kosong = Sesi(tipe="guest")
    db.session.add(kosong)
    db.session.commit()
    kosong.mulai_pada = None
    db.session.commit()

    assert SesiRepository.get_distinct_tanggal("Asia/Jakarta") == [
        "2025-01-03", "2025-01-02", "2025-01-01"
    ]
