# app/services/user_service.py

"""Service untuk mengelola User (Kasir/Admin).

Menangani business logic untuk pembuatan, update, penonaktifan,
dan hapus data staff yang mengoperasikan sistem billing.
"""

from app.models import db
from app.repositories import UserRepository
from app.utils.logger import write_log
from app.utils.validators import validate_username, validate_password, validate_string_length

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
        username = validate_username(data.get("username", ""), min_len=3, max_len=30, lowercase_only=False)
        password = validate_password(data.get("password", ""), min_len=6, max_len=32)
        nama_lengkap = validate_string_length(data.get("nama_lengkap", ""), min_len=0, max_len=100, field_name="Nama lengkap", required=False)
        role = str(data.get("role", "kasir")).strip().lower()
        if role not in ["admin", "kasir"]:
            raise ValueError("Role harus 'admin' atau 'kasir'")

        aktif = str(data.get("aktif", "true")).lower() == "true"

        if UserRepository.find_by_username(username):
            raise ValueError("Username sudah terdaftar")

        from app.models import User
        new_user = User(
            username=username,
            nama_lengkap=nama_lengkap,
            role=role,
            aktif=aktif
        )
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.commit()
        
        detail_user = {
            "username": username,
            "nama_lengkap": nama_lengkap,
            "role": role,
            "aktif": aktif
        }
        write_log("TAMBAH_USER", f"Role:{role} | User:{username}", user=operator, detail_json=detail_user)
        return new_user.to_dict()

    @staticmethod
    def update_user(user_id, data, operator="admin"):
        """Perbarui data user yang ada."""
        user = UserRepository.get_by_id(user_id)
        if not user:
            raise ValueError("User tidak ditemukan")

        if "username" in data and data["username"]:
            username = validate_username(data["username"], min_len=3, max_len=30, lowercase_only=False)
            if username != user.username:
                if UserRepository.find_by_username(username):
                    raise ValueError("Username sudah dipakai oleh orang lain")
                user.username = username

        if "nama_lengkap" in data:
            user.nama_lengkap = validate_string_length(data["nama_lengkap"], min_len=0, max_len=100, field_name="Nama lengkap", required=False)
            
        if "role" in data and data["role"]:
            role = str(data["role"]).strip().lower()
            if role not in ["admin", "kasir"]:
                raise ValueError("Role harus 'admin' atau 'kasir'")
            user.role = role
            
        if "aktif" in data and data["aktif"] is not None:
            user.aktif = str(data["aktif"]).lower() == "true"

        if "password" in data and data["password"]:
            password = validate_password(data["password"], min_len=6, max_len=32)
            user.set_password(password)
        
        db.session.commit()
        
        detail_user = {
            "username": user.username,
            "nama_lengkap": user.nama_lengkap,
            "role": user.role,
            "aktif": user.aktif
        }
        write_log("UPDATE_USER", f"ID:{user_id} | User:{user.username}", user=operator, detail_json=detail_user)
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
        write_log("HAPUS_USER", f"User:{user.username} dihapus secara permanen", user=operator, detail_json={"username": user.username})
        return {"success": True, "message": "User berhasil dihapus"}
