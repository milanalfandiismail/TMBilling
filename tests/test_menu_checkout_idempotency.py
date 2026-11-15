"""Kunci idempotensi checkout FnB hanya dipakai oleh request yang sah."""

import pytest

from app import create_app
from app.models import db, MenuItem, User
from app.services import idempotency
from app.services.menu.menu_service import MenuService


@pytest.fixture
def app_ctx():
    app = create_app({"TESTING": True, "WTF_CSRF_ENABLED": False,
                      "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        idempotency.reset()
        kasir = User(username="kasir1", nama_lengkap="Kasir", role="kasir", aktif=True)
        kasir.set_password("kasir123")
        menu = MenuItem(nama="Kopi Uji", harga=5000, stok=2)
        db.session.add_all([kasir, menu])
        db.session.commit()
        yield {"menu_id": menu.id}
        db.session.remove()
        db.drop_all()
        idempotency.reset()


def _cart(menu_id, jumlah=1):
    return [{"menu_id": menu_id, "jumlah": jumlah}]


def test_keranjang_invalid_tidak_membakar_kunci(app_ctx):
    with pytest.raises(ValueError):
        MenuService.checkout_menu_order([], None, "kasir1", client_request_id="req-1")
    hasil = MenuService.checkout_menu_order(
        _cart(app_ctx["menu_id"]), None, "kasir1", tunai=5000, client_request_id="req-1")
    assert len(hasil) == 1


def test_request_ganda_ditolak(app_ctx):
    MenuService.checkout_menu_order(
        _cart(app_ctx["menu_id"]), None, "kasir1", tunai=5000, client_request_id="req-2")
    with pytest.raises(ValueError, match="sudah diproses"):
        MenuService.checkout_menu_order(
            _cart(app_ctx["menu_id"]), None, "kasir1", tunai=5000, client_request_id="req-2")


def test_stok_kurang_tidak_membakar_kunci(app_ctx):
    with pytest.raises(ValueError, match="tidak mencukupi"):
        MenuService.checkout_menu_order(
            _cart(app_ctx["menu_id"], 5), None, "kasir1", tunai=25000, client_request_id="req-3")
    hasil = MenuService.checkout_menu_order(
        _cart(app_ctx["menu_id"], 1), None, "kasir1", tunai=5000, client_request_id="req-3")
    assert len(hasil) == 1


def test_penolakan_duplikat_tidak_melepas_kunci(app_ctx):
    """Retry ketiga dengan kunci sama tetap ditolak.

    Kunci hanya boleh dilepas bila request yang memegang kunci gagal,
    bukan oleh request duplikat yang justru ditolak karena kunci itu.
    """
    cart = _cart(app_ctx["menu_id"])
    MenuService.checkout_menu_order(cart, None, "kasir1", tunai=5000, client_request_id="req-4")
    with pytest.raises(ValueError, match="sudah diproses"):
        MenuService.checkout_menu_order(cart, None, "kasir1", tunai=5000, client_request_id="req-4")
    with pytest.raises(ValueError, match="sudah diproses"):
        MenuService.checkout_menu_order(cart, None, "kasir1", tunai=5000, client_request_id="req-4")
