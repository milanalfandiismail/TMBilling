"""Checkout FnB tidak boleh memuat ulang menu/transaksi setelah commit."""

import pytest
from sqlalchemy import event

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
        menu = [MenuItem(nama=f"Menu-{i}", harga=5000, stok=10) for i in range(3)]
        db.session.add_all([kasir, *menu])
        db.session.commit()
        ids = [m.id for m in menu]
        db.session.remove()  # paksa session baru seperti request nyata, agar lookup benar-benar SQL
        yield ids
        db.session.remove()
        db.drop_all()
        idempotency.reset()


def test_tiga_item_tidak_memuat_ulang_menu(app_ctx):
    queries = []
    engine = db.engine

    def catat(conn, cursor, statement, params, context, executemany):
        queries.append(statement)

    event.listen(engine, "before_cursor_execute", catat)
    try:
        hasil = MenuService.checkout_menu_order(
            [{"menu_id": mid, "jumlah": 1} for mid in app_ctx],
            None, "kasir1", tunai=15000)
    finally:
        event.remove(engine, "before_cursor_execute", catat)

    assert [h["menu_nama"] for h in hasil] == ["Menu-0", "Menu-1", "Menu-2"]
    # 2 query per item: lookup validasi + guard atomik decrement_stok_if_available.
    # Yang diuji di sini: tidak ada muat ulang pasca-commit (dulu 3 extra).
    assert sum(1 for q in queries if "FROM menu_item " in q) == 6
    # Satu-satunya SELECT transaksi_menu yang sah adalah generator nomor nota (MAX).
    assert not any(q.lstrip().startswith("SELECT transaksi_menu") for q in queries), "tidak boleh ada muat ulang transaksi pasca-commit"
