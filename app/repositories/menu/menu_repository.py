# app/repositories/menu_repository.py

"""Repository untuk entitas MenuItem dan TransaksiMenu.

Modul ini mengelola kueri database langsung ke tabel menu_item dan transaksi_menu.
"""

from app.models import MenuItem, TransaksiMenu
from app.models import db

class MenuRepository:
    """Repository class untuk mengelola data MenuItem dan TransaksiMenu."""

    @staticmethod
    def get_by_id(menu_id):
        """Mengambil data menu aktif berdasarkan ID. Return None untuk menu yang diarsipkan."""
        return MenuItem.query.filter_by(id=menu_id, is_active=True).first()

    @staticmethod
    def get_by_id_including_archived(menu_id):
        """Mengambil data menu berdasarkan ID, termasuk yang sudah diarsipkan."""
        return MenuItem.query.get(menu_id)

    @staticmethod
    def get_by_name(nama):
        """Mendapatkan data menu AKTIF berdasarkan nama (untuk cek duplikat saat create)."""
        return MenuItem.query.filter_by(nama=nama, is_active=True).first()

    @staticmethod
    def get_by_name_including_archived(nama):
        """Mendapatkan data menu berdasarkan nama, termasuk yang sudah diarsipkan."""
        return MenuItem.query.filter_by(nama=nama).first()

    @staticmethod
    def get_all():
        """Mengambil semua menu aktif di katalog."""
        return MenuItem.query.filter_by(is_active=True).order_by(MenuItem.nama.asc()).all()

    @staticmethod
    def count_transaksi_by_menu(menu_id):
        """Menghitung jumlah transaksi menu yang terkait dengan menu_id."""
        return TransaksiMenu.query.filter_by(menu_id=menu_id).count()

    @staticmethod
    def delete_transaksi_by_menu(menu_id):
        """Menghapus seluruh transaksi menu yang terkait dengan menu_id."""
        TransaksiMenu.query.filter_by(menu_id=menu_id).delete()

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
    def get_total_pemasukan_by_date(date_obj, kasir_id=None, metode_pembayaran=None):
        """Menghitung total pendapatan F&B pada tanggal tertentu, opsional difilter kasir."""
        res = db.session.query(db.func.sum(TransaksiMenu.total_harga)).select_from(TransaksiMenu).filter(
            db.func.date(TransaksiMenu.tanggal) == date_obj
        )
        if kasir_id:
            res = res.filter(TransaksiMenu.kasir_id == kasir_id)
        if metode_pembayaran:
            if metode_pembayaran == "Tunai":
                res = res.filter(
                    (TransaksiMenu.metode_pembayaran.in_(["Tunai", "Cash"])) | 
                    (TransaksiMenu.metode_pembayaran == None)
                )
            else:
                res = res.filter(TransaksiMenu.metode_pembayaran == metode_pembayaran)
        val = res.scalar()
        return int(val) if val else 0

    @staticmethod
    def get_transactions_by_date(date_obj, kasir_id=None):
        """Mendapatkan daftar transaksi F&B pada tanggal tertentu, opsional difilter kasir."""
        query = TransaksiMenu.query.filter(db.func.date(TransaksiMenu.tanggal) == date_obj)
        if kasir_id:
            query = query.filter(TransaksiMenu.kasir_id == kasir_id)
        return query.order_by(TransaksiMenu.tanggal.desc()).all()

    @staticmethod
    def get_transactions_by_date_paginated(date_obj, page, per_page, kasir_id=None, metode_pembayaran=None):
        """Mendapatkan daftar transaksi F&B dengan pagination pada tanggal tertentu."""
        query = TransaksiMenu.query.filter(db.func.date(TransaksiMenu.tanggal) == date_obj)
        if kasir_id:
            query = query.filter(TransaksiMenu.kasir_id == kasir_id)
        if metode_pembayaran:
            if metode_pembayaran == "Tunai":
                query = query.filter(
                    (TransaksiMenu.metode_pembayaran.in_(["Tunai", "Cash"])) | 
                    (TransaksiMenu.metode_pembayaran == None)
                )
            else:
                query = query.filter(TransaksiMenu.metode_pembayaran == metode_pembayaran)
        return query.order_by(TransaksiMenu.tanggal.desc()).paginate(page=page, per_page=per_page, error_out=False)

    @staticmethod
    def get_by_no_nota(no_nota):
        """Mencari transaksi menu berdasarkan nomor nota."""
        return TransaksiMenu.query.filter_by(no_nota=no_nota).first()
