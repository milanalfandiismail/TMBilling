# app/services/transaksi_service.py

"""Service untuk manajemen transaksi dan keuangan.

Modul ini menangani business logic terkait pembuatan nota,
pencatatan transaksi gabungan, dan perhitungan saldo.
"""

from datetime import datetime
from app.repositories import TransaksiRepository
from app.repositories import UserRepository

class TransaksiService:

    @staticmethod
    def get_user_id(operator):
        """ID user operator; None bila tidak dikenal (jangan menebak admin pertama)."""
        if operator and operator != "system":
            base_operator = operator.split(" (")[0].strip() if " (" in operator else operator
            user = UserRepository.get_by_username(base_operator)
            return user.id if user else None
        return None
    """Service untuk mengelola logika bisnis transaksi."""

    @staticmethod
    def generate_nota():
        """Generate nomor nota unik dengan format TM-YYYYMMDD-NNN.
        
        Mencari suffix tertinggi hari ini untuk menghindari UNIQUE constraint error
        jika ada data yang dihapus sebelumnya.
        """
        from app.utils.timezone_utils import display_in_tz, now_utc
        today_local = display_in_tz(now_utc())
        date_str = today_local.strftime('%Y%m%d')
        prefix = f"TM-{date_str}-"
        
        # Cari transaksi terakhir hari ini dengan filter LIKE
        last_t = TransaksiRepository.get_last_nota_today(date_str)
        
        if last_t and last_t.no_nota:
            try:
                # Ambil 3 angka terakhir: TM-YYYYMMDD-NNN -> NNN
                last_num = int(last_t.no_nota.split('-')[-1])
                new_num = last_num + 1
            except (ValueError, IndexError):
                new_num = TransaksiRepository.count_by_date(today_local.date()) + 1
        else:
            new_num = 1
            
        from app.models import Transaksi
        candidate = f"{prefix}{str(new_num).zfill(3)}"
        while Transaksi.query.filter_by(no_nota=candidate).first() is not None:
            new_num += 1
            candidate = f"{prefix}{str(new_num).zfill(3)}"
        return candidate
