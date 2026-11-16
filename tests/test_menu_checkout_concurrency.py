"""Checkout FnB paralel tidak boleh menjual melebihi stok."""

import threading
from pathlib import Path

import pytest

from app import create_app, db
from app.models import MenuItem, User
from app.services.menu.menu_service import MenuService


@pytest.fixture()
def app_ctx(tmp_path):
    uri = "sqlite:///" + str(tmp_path / "concurrent.db").replace("\\", "/")
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": uri,
    })
    with app.app_context():
        db.create_all()
        kasir = User(username="kasir1", nama_lengkap="Kasir Uji", role="kasir", aktif=True)
        kasir.set_password("rahasia123")
        menu = MenuItem(nama="Kopi Uji", harga=5000, stok=5, is_active=True)
        db.session.add_all([kasir, menu])
        db.session.commit()
        menu_id = menu.id
        db.session.remove()
        yield app, menu_id
        db.session.remove()
        db.engine.dispose()


def test_checkout_paralel_tidak_melebihi_stok(app_ctx):
    app, menu_id = app_ctx
    hasil = []
    kunci = threading.Lock()

    def satu_checkout():
        with app.app_context():
            try:
                MenuService.checkout_menu_order(
                    [{"menu_id": menu_id, "jumlah": 1}], None, "kasir1", tunai=5000)
                dengan = True
            except Exception:
                db.session.rollback()
                dengan = False
            finally:
                db.session.remove()
        with kunci:
            hasil.append(dengan)

    threads = [threading.Thread(target=satu_checkout) for _ in range(16)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    with app.app_context():
        assert sum(hasil) == 5
        assert db.session.get(MenuItem, menu_id).stok == 0
        nota = {r[0] for r in db.session.execute(db.text("SELECT no_nota FROM transaksi_menu")).fetchall()}
        assert len(nota) == 5
