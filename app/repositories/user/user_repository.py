# app/repositories/user_repository.py

"""Repository untuk entitas User.

Modul ini mengelola operasi database untuk autentikasi
dan manajemen user kasir/admin.
"""

from app.models import User
from app.models import db


class UserRepository:
    """Repository class untuk mengelola data User (Admin/Kasir)."""

    # =========================================================================
    # 1. PENGAMBILAN DATA & AUTENTIKASI (READ)
    # =========================================================================
    # Fokus: Mendapatkan data user untuk proses login dan validasi session.

    @staticmethod
    def get_by_username(username):
        """Mengambil user aktif berdasarkan username.
        
        Note: Hanya mengembalikan user dengan status aktif=True.
        """
        return User.query.filter_by(username=username, aktif=True).first()

    @staticmethod
    def get_all_active():
        """Mengambil semua kasir/admin yang aktif."""
        return User.query.filter_by(aktif=True).order_by(User.id.asc()).all()


    @staticmethod
    def get_by_id(user_id):
        return User.query.get(user_id)

    @staticmethod
    def get_all():
        """Mengambil semua user (aktif dan tidak)."""
        return User.query.order_by(User.id.asc()).all()

    @staticmethod
    def find_by_username(username):
        """Mencari user berdasarkan username tanpa memfilter status aktif."""
        return User.query.filter_by(username=username).first()

    @staticmethod
    def count_active_admins():
        """Menghitung jumlah user dengan role 'admin' dan status aktif."""
        return User.query.filter_by(role='admin', aktif=True).count()

    # =========================================================================
    # 2. OPERASI PENYIMPANAN (WRITE)
    # =========================================================================
    # Fokus: Simpan atau update data kasir/admin.

    @staticmethod
    def save(user):
        """Menambahkan user baru atau update (Tanpa Commit)."""
        db.session.add(user)

    @staticmethod
    def delete(user):
        """Menghapus user (Tanpa Commit)."""
        db.session.delete(user)

