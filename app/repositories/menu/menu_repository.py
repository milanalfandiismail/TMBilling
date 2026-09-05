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
    def count_transactions_by_prefix(prefix):
        """Menghitung total transaksi menu berdasarkan prefix nomor nota."""
        return TransaksiMenu.query.filter(TransaksiMenu.no_nota.like(f"{prefix}%")).count()

    @staticmethod
    def _apply_kasir_filter(query, kasir_id):
        """Menerapkan filter kasir secara akurat (lokal vs remote operator)."""
        if not kasir_id or str(kasir_id).strip().lower() in ["", "semua", "none"]:
            return query
        kasir_str = str(kasir_id).strip()
        if kasir_str.startswith("operator:"):
            target_op = kasir_str.split("operator:", 1)[1].strip()
            return query.filter(TransaksiMenu.operator == target_op)
        if "(Remote:" in kasir_str:
            return query.filter(TransaksiMenu.operator == kasir_str)
        if kasir_str.isdigit():
            uid = int(kasir_str)
            return query.filter(
                TransaksiMenu.kasir_id == uid,
                db.or_(
                    TransaksiMenu.operator == None,
                    TransaksiMenu.operator == '',
                    ~TransaksiMenu.operator.like('%(Remote:%')
                )
            )
        return query

    @staticmethod
    def get_distinct_remote_operators():
        """Mengambil nama operator remote unik dari transaksi menu."""
        results = db.session.query(TransaksiMenu.operator).filter(
            TransaksiMenu.operator.like('%(Remote:%')
        ).distinct().all()
        return [r[0] for r in results if r[0]]

    @staticmethod
    def get_total_pemasukan_by_date(date_obj, kasir_id=None, metode_pembayaran=None):
        """Menghitung total pendapatan F&B pada tanggal tertentu, opsional difilter kasir."""
        res = db.session.query(db.func.sum(TransaksiMenu.total_harga)).select_from(TransaksiMenu).filter(
            db.func.date(TransaksiMenu.tanggal) == date_obj
        )
        res = MenuRepository._apply_kasir_filter(res, kasir_id)
        if metode_pembayaran:
            if metode_pembayaran == "Tunai":
                query_cond = (TransaksiMenu.metode_pembayaran.in_(["Tunai", "Cash"])) | (TransaksiMenu.metode_pembayaran == None)
                res = res.filter(query_cond)
            else:
                res = res.filter(TransaksiMenu.metode_pembayaran == metode_pembayaran)
        val = res.scalar()
        return int(val) if val else 0

    @staticmethod
    def get_transactions_by_date(date_obj, kasir_id=None, metode_pembayaran=None):
        """Mendapatkan daftar transaksi F&B pada tanggal tertentu, opsional difilter kasir."""
        query = TransaksiMenu.query.filter(db.func.date(TransaksiMenu.tanggal) == date_obj)
        query = MenuRepository._apply_kasir_filter(query, kasir_id)
        if metode_pembayaran:
            if metode_pembayaran == "Tunai":
                query = query.filter(
                    (TransaksiMenu.metode_pembayaran.in_(["Tunai", "Cash"])) | 
                    (TransaksiMenu.metode_pembayaran == None)
                )
            else:
                query = query.filter(TransaksiMenu.metode_pembayaran == metode_pembayaran)
        return query.order_by(TransaksiMenu.tanggal.desc()).all()

    @staticmethod
    def get_transactions_by_date_paginated(date_obj, page, per_page, kasir_id=None, metode_pembayaran=None):
        """Mendapatkan daftar transaksi F&B dengan pagination pada tanggal tertentu."""
        query = TransaksiMenu.query.filter(db.func.date(TransaksiMenu.tanggal) == date_obj)
        query = MenuRepository._apply_kasir_filter(query, kasir_id)
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
