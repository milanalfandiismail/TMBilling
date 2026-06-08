# app/repositories/grup_repository.py

"""Repository untuk entitas Grup.

Modul ini menyediakan interface untuk operasi database terkait
grup/kategori yang digunakan untuk mengelompokkan PC, Member, dan Paket.
"""

from app.models.grup import Grup
from app.models.base import db


class GrupRepository:
    """Repository class untuk mengelola data Grup."""

    # =========================================================================
    # 1. PENGAMBILAN DATA (READ)
    # =========================================================================
    # Fokus: Mengambil data grup berdasarkan ID atau mengambil seluruh daftar.

    @staticmethod
    def get_all():
        """Mengambil semua grup yang tersedia."""
        return Grup.query.all()

    @staticmethod
    def get_by_id(id):
        """Mengambil grup berdasarkan ID (Primary Key)."""
        return Grup.query.get(id)


    # =========================================================================
    # 2. PENCARIAN & VALIDASI (SEARCH)
    # =========================================================================
    # Fokus: Mencari record berdasarkan nama untuk validasi input.

    @staticmethod
    def find_by_nama(nama):
        """Mencari grup berdasarkan nama (case-insensitive)."""
        # Nama dikonversi ke lowercase dan di-strip sebelum query
        return Grup.query.filter_by(nama=nama.lower().strip()).first()


    # =========================================================================
    # 3. OPERASI PENYIMPANAN & PENGHAPUSAN (WRITE)
    # =========================================================================
    # Fokus: Menambah, mengupdate, atau menghapus record grup.

    @staticmethod
    def save(grup):
        """Menyimpan grup (Tanpa Commit)."""
        db.session.add(grup)

    @staticmethod
    def delete(grup):
        """Menghapus grup (Tanpa Commit)."""
        db.session.delete(grup)

