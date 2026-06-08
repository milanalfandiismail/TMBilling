# app/services/user_service.py

"""Service untuk mengelola User (Kasir/Admin).

Menangani business logic untuk pembuatan, update, penonaktifan,
dan hapus data staff yang mengoperasikan sistem billing.
"""

from app.models.base import db
from app.repositories.user_repository import UserRepository
from app.utils.logger import write_log

class UserService:
    """Service untuk manajemen data User kasir/admin."""

    @staticmethod
    def get_all_users():
        """Ambil semua data user."""
        users = UserRepository.get_all()
        return [u.to_dict() for u in users]

    @staticmethod
    def get_user(user_id):
        """Ambil data user spesifik."""
        user = UserRepository.get_by_id(user_id)
        if not user:
            raise ValueError("User tidak ditemukan")
        return user.to_dict()

    @staticmethod
    def create_user(data, operator="admin"):
        """Buat user / kasir baru."""
        username = data.get("username", "").strip()
        password = data.get("password", "")
        nama_lengkap = data.get("nama_lengkap", "").strip()
        role = data.get("role", "kasir")
        aktif = str(data.get("aktif", "true")).lower() == "true"

        if not username or not password:
            raise ValueError("Username dan Password wajib diisi")

        if UserRepository.find_by_username(username):
            raise ValueError("Username sudah terdaftar")

        from app.models.user import User
        new_user = User(
            username=username,
            nama_lengkap=nama_lengkap,
            role=role,
            aktif=aktif
        )
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.commit()
        
        write_log("TAMBAH_USER", f"Role:{role} | User:{username}", user=operator)
        return new_user.to_dict()

    @staticmethod
    def update_user(user_id, data, operator="admin"):
        """Perbarui data user yang ada."""
        user = UserRepository.get_by_id(user_id)
        if not user:
            raise ValueError("User tidak ditemukan")

        username = data.get("username", "").strip()
        password = data.get("password", "")
        nama_lengkap = data.get("nama_lengkap", "").strip()
        role = data.get("role")
        aktif = data.get("aktif")

        if username and username != user.username:
            if UserRepository.find_by_username(username):
                raise ValueError("Username sudah dipakai oleh orang lain")
            user.username = username

        if nama_lengkap:
            user.nama_lengkap = nama_lengkap
            
        if role:
            user.role = role
            
        if aktif is not None:
            user.aktif = str(aktif).lower() == "true"

        if password:
            user.set_password(password)
        
        db.session.commit()
        write_log("UPDATE_USER", f"ID:{user_id} | User:{user.username}", user=operator)
        return user.to_dict()

    @staticmethod
    def delete_user(user_id, operator="admin"):
        """Hapus user (atau nonaktifkan jika berisiko)."""
        user = UserRepository.get_by_id(user_id)
        if not user:
            raise ValueError("User tidak ditemukan")
            
        if user.role == 'admin':
            # Pastikan minimal ada 1 admin yang tersisa
            admin_count = UserRepository.count_active_admins()
            if admin_count <= 1:
                raise ValueError("Tidak dapat menghapus satu-satunya Admin tersisa!")

        # Hard delete. Kalau ada referensi di tabel transaksi (user_id), pastikan di-set NULL.
        # SQLite ForeignKey ondelete="SET NULL" sudah dipasang di transaksi.py
        db.session.delete(user)
        db.session.commit()
        write_log("HAPUS_USER", f"User:{user.username} dihapus secara permanen", user=operator)
        return {"success": True, "message": "User berhasil dihapus"}
