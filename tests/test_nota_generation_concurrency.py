import uuid
import pytest
from app import create_app
from app.models import db, Transaksi, TransaksiMenu, MenuItem, User
from app.services.transaksi.transaksi_service import TransaksiService
from app.services.menu.menu_service import MenuService
from app.utils.timezone_utils import display_in_tz, now_utc


def test_transaksi_nota_generation_anti_collision_and_monotonic():
    """Memastikan generate_nota pada TransaksiService tidak menghasilkan nomor duplikat
    meskipun transaksi sebelumnya dihapus atau ada transaksi existing."""
    app = create_app()
    with app.app_context():
        today_local = display_in_tz(now_utc())
        date_str = today_local.strftime('%Y%m%d')
        prefix = f"TM-{date_str}-"

        # Buat dummy transaksi dengan nota manual bernomor 005
        t = Transaksi(
            no_nota=f"{prefix}005",
            jumlah=10000,
            jenis="billing",
            metode_pembayaran="tunai"
        )
        db.session.add(t)
        db.session.commit()

        try:
            # Nota selanjutnya HARUS 006, bukan 001 atau 002 (karena max existing adalah 005)
            next_nota = TransaksiService.generate_nota()
            assert next_nota == f"{prefix}006"
        finally:
            db.session.delete(t)
            db.session.commit()


def test_menu_nota_generation_anti_skip_on_multi_item_order():
    """Memastikan nota menu (TMM-YYYYMMDD-NNN) tidak loncat angka
    ketika transaksi sebelumnya memesan banyak item dalam satu keranjang (multi-row)."""
    app = create_app()
    with app.app_context():
        today_local = display_in_tz(now_utc())
        date_str = today_local.strftime('%Y%m%d')
        prefix = f"TMM-{date_str}-"

        # Setup user kasir & menu item
        user = User.query.first()
        if not user:
            user = User(username="kasir1", role="kasir", nama_lengkap="Kasir Test")
            user.set_password("pass123")
            db.session.add(user)
            db.session.commit()

        u_id = uuid.uuid4().hex[:6]
        m1 = MenuItem(nama=f"Es Teh {u_id}", harga=3000, stok=100)
        m2 = MenuItem(nama=f"Mie Goreng {u_id}", harga=6000, stok=100)
        db.session.add_all([m1, m2])
        db.session.commit()

        res1 = None
        res2 = None
        try:
            # Order 1: Beli 2 item sekaligus (akan menghasilkan 2 baris TransaksiMenu dengan nota yang sama)
            cart = [
                {"menu_id": m1.id, "jumlah": 1},
                {"menu_id": m2.id, "jumlah": 1}
            ]
            res1 = MenuService.checkout_menu_order(
                cart_items=cart,
                pc_kode="PC-01",
                kasir_username=user.username,
                operator=user.username,
                tunai=10000,
                metode_pembayaran="Tunai"
            )
            nota1 = res1[0]["no_nota"]
            assert nota1.startswith(prefix)

            # Order 2: Beli 1 item
            cart2 = [{"menu_id": m1.id, "jumlah": 1}]
            res2 = MenuService.checkout_menu_order(
                cart_items=cart2,
                pc_kode="PC-01",
                kasir_username=user.username,
                operator=user.username,
                tunai=5000,
                metode_pembayaran="Tunai"
            )
            nota2 = res2[0]["no_nota"]

            # Nomor nota kedua harus persis n+1 dari nomor nota pertama (TIDAK BOLEH loncat karena 2 item di order 1)
            num1 = int(nota1.split('-')[2])
            num2 = int(nota2.split('-')[2])
            assert num2 == num1 + 1, f"Nomor nota meloncat! order1={nota1}, order2={nota2}"

        finally:
            # Cleanup
            notae = []
            if res1 and len(res1) > 0:
                notae.append(res1[0]["no_nota"])
            if res2 and len(res2) > 0:
                notae.append(res2[0]["no_nota"])
            if notae:
                TransaksiMenu.query.filter(TransaksiMenu.no_nota.in_(notae)).delete(synchronize_session=False)
            db.session.delete(m1)
            db.session.delete(m2)
            db.session.commit()
