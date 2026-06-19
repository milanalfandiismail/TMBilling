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
        if operator and operator not in ("system", "kasir"):
            user = UserRepository.get_by_username(operator)
            if user:
                return user.id
        return None
    """Service untuk mengelola logika bisnis transaksi."""

    @staticmethod
    def generate_nota():
        """Generate nomor nota unik dengan format TM-YYYYMMDD-NNN.
        
        Mencari suffix tertinggi hari ini untuk menghindari UNIQUE constraint error
        jika ada data yang dihapus sebelumnya.
        """
        today = datetime.now()
        date_str = today.strftime('%Y%m%d')
        prefix = f"TM-{date_str}-"
        
        # Cari transaksi terakhir hari ini dengan filter LIKE
        last_t = TransaksiRepository.get_last_nota_today(date_str)
        
        if last_t and last_t.no_nota:
            try:
                # Ambil 3 angka terakhir: TM-YYYYMMDD-NNN -> NNN
                last_num = int(last_t.no_nota.split('-')[-1])
                new_num = last_num + 1
            except (ValueError, IndexError):
                new_num = TransaksiRepository.count_by_date(today.date()) + 1
        else:
            new_num = 1
            
        return f"{prefix}{str(new_num).zfill(3)}"
