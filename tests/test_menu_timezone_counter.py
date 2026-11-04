import uuid
from datetime import datetime, timedelta
import pytest
from app import create_app
from app.models import db, MenuItem, TransaksiMenu
from app.repositories import MenuRepository
from app.services import MenuService
from app.utils.timezone_utils import get_local_date_range_utc, now_utc, display_in_tz


def test_menu_count_transactions_today_uses_local_timezone_range():
    """Memastikan count_transactions_today menggunakan rentang tanggal lokal warnet
    (get_local_date_range_utc), bukan host system datetime.now()."""
    app = create_app()
    with app.app_context():
        tag = uuid.uuid4().hex[:6]
        menu = MenuItem(nama=f"Kopi {tag}", harga=5000, stok=50)
        db.session.add(menu)
        db.session.commit()

        start_utc, end_utc = get_local_date_range_utc()

        # 1. Transaksi tepat di dalam hari lokal (misal: 1 jam setelah start_utc)
        inside_today = start_utc + timedelta(hours=1)
        tm_today = TransaksiMenu(
            no_nota=f"TMM-{tag}-001",
            menu_id=menu.id,
            jumlah=1,
            total_harga=5000,
            tanggal=inside_today
        )
        # 2. Transaksi kemarin hari lokal (misal: 1 jam sebelum start_utc)
        before_today = start_utc - timedelta(hours=1)
        tm_yesterday = TransaksiMenu(
            no_nota=f"TMM-{tag}-002",
            menu_id=menu.id,
            jumlah=1,
            total_harga=5000,
            tanggal=before_today
        )
        db.session.add_all([tm_today, tm_yesterday])
        db.session.commit()

        # Hitung dengan query manual yang tahu start_utc & end_utc
        expected_today = TransaksiMenu.query.filter(
            TransaksiMenu.tanggal >= start_utc,
            TransaksiMenu.tanggal < end_utc
        ).count()

        # Ambil count hari ini dari repository
        total_today = MenuRepository.count_transactions_today()
        # total_today dari repository harus sama persis dengan rentang UTC hari lokal
        assert total_today == expected_today


def test_generate_nota_menu_uses_display_in_tz():
    """Memastikan nomor nota diawali tanggal lokal YYYYMMDD sesuai timezone setting."""
    app = create_app()
    with app.app_context():
        today_local = display_in_tz(now_utc())
        expected_date_str = today_local.strftime('%Y%m%d')

        nota = MenuService.generate_nota_menu()
        assert nota.startswith(f"TMM-{expected_date_str}-")
