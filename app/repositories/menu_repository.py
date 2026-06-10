# app/repositories/menu_repository.py

"""Repository untuk entitas MenuItem dan TransaksiMenu.

Modul ini mengelola kueri database langsung ke tabel menu_item dan transaksi_menu.
"""

from app.models.menu import MenuItem, TransaksiMenu
from app.models.base import db

class MenuRepository:
    """Repository class untuk mengelola data MenuItem dan TransaksiMenu."""

    @staticmethod
    def get_by_id(menu_id):
        """Mengambil data menu berdasarkan ID."""
        return MenuItem.query.get(menu_id)

    @staticmethod
    def get_by_name(nama):
        """Mendapatkan data menu berdasarkan nama."""
        return MenuItem.query.filter_by(nama=nama).first()

    @staticmethod
    def get_all():
        """Mengambil semua menu di katalog."""
        return MenuItem.query.order_by(MenuItem.nama.asc()).all()

    @staticmethod
    def save(obj):
        """Menyimpan data MenuItem atau TransaksiMenu (Tanpa Commit)."""
        db.session.add(obj)

    @staticmethod
    def delete(obj):
        """Menghapus data MenuItem atau TransaksiMenu (Tanpa Commit)."""
        db.session.delete(obj)

    @staticmethod
    def get_transaksi_all():
        """Mengambil semua riwayat transaksi penjualan menu."""
        return TransaksiMenu.query.order_by(TransaksiMenu.tanggal.desc()).all()

    @staticmethod
    def get_transaksi_by_id(t_id):
        """Mengambil data transaksi menu berdasarkan ID."""
        return TransaksiMenu.query.get(t_id)

    @staticmethod
    def count_transactions_today():
        """Menghitung total transaksi menu hari ini."""
        from datetime import datetime, time
        today_start = datetime.combine(datetime.now().date(), time.min)
        return TransaksiMenu.query.filter(TransaksiMenu.tanggal >= today_start).count()

    @staticmethod
    def get_total_pemasukan_by_date(date_obj, kasir_id=None):
        """Menghitung total pendapatan F&B pada tanggal tertentu, opsional difilter kasir."""
        query = TransaksiMenu.query.filter(db.func.date(TransaksiMenu.tanggal) == date_obj)
        if kasir_id:
            query = query.filter(TransaksiMenu.kasir_id == kasir_id)
        res = db.session.query(db.func.sum(TransaksiMenu.total_harga)).select_from(TransaksiMenu).filter(
            db.func.date(TransaksiMenu.tanggal) == date_obj
        )
        if kasir_id:
            res = res.filter(TransaksiMenu.kasir_id == kasir_id)
        val = res.scalar()
        return int(val) if val else 0

    @staticmethod
    def get_transactions_by_date(date_obj, kasir_id=None):
        """Mendapatkan daftar transaksi F&B pada tanggal tertentu, opsional difilter kasir."""
        query = TransaksiMenu.query.filter(db.func.date(TransaksiMenu.tanggal) == date_obj)
        if kasir_id:
            query = query.filter(TransaksiMenu.kasir_id == kasir_id)
        return query.order_by(TransaksiMenu.tanggal.desc()).all()
