# app/services/transaksi_service.py

"""Service untuk manajemen transaksi dan keuangan.

Modul ini menangani business logic terkait pembuatan nota,
pencatatan transaksi gabungan, dan perhitungan saldo.
"""

import secrets
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
        
        # Cari nomor urut tertinggi hari ini dalam satu query agregat
        new_num = TransaksiRepository.get_max_nota_seq(date_str) + 1

        return f"{prefix}{str(new_num).zfill(3)}-{secrets.token_hex(3)}"
