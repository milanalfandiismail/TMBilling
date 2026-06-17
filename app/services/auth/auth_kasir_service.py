# app/services/auth_kasir_service.py

"""Service untuk autentikasi kasir/admin web.

Modul ini menangani login/logout untuk user dashboard kasir
yang mengoperasikan sistem melalui web interface.
"""

from app.repositories import UserRepository
from app.utils.logger import write_log


class AuthKasirService:
    """Service untuk autentikasi user kasir/admin."""

    # =========================================================================
    # 1. AUTHENTICATION (LOGIN / LOGOUT)
    # =========================================================================
    # Fokus: Menangani proses masuk dan keluar user serta pencatatan log audit.

    @staticmethod
    def login(username, password):
        """Autentikasi kasir/admin dengan validasi kredensial."""
        if not username or not password:
            raise ValueError("Username dan password wajib diisi")
        
        user = UserRepository.get_by_username(username)
        
        # Validasi user ada dan password cocok
        if not user or not user.check_password(password):
            write_log("LOGIN_GAGAL", f"Username:{username} - Password salah")
            raise ValueError("Username atau password salah")
        
        # Catat log sukses dan return data user
        write_log("LOGIN", f"Kasir:{username} ({user.nama_lengkap or ''}) login")
        return {
            "success": True,
            "user": user.to_dict(),
            "message": f"Selamat datang, {user.nama_lengkap or user.username}"
        }

    @staticmethod
    def logout(username):
        """Logout kasir dan mencatat jejak audit."""
        write_log("LOGOUT", f"Kasir {username} logout")
        return {"success": True, "message": "Logout berhasil"}

    @staticmethod
    def validate_admin(username, password):
        """Validasi kredensial khusus untuk hak akses Admin (bypass/special)."""
        if not username or not password:
            raise ValueError("Kredensial wajib diisi")
        
        user = UserRepository.get_by_username(username)
        if not user or not user.check_password(password):
            write_log("ADMIN_CHECK_FAILED", f"Username:{username} - Salah password")
            raise ValueError("Username atau password salah")
        
        if user.role != "admin":
            write_log("ADMIN_CHECK_DENIED", f"User:{username} bukan admin")
            raise ValueError("Akses ditolak. Perlu hak akses Admin.")
        
        return {
            "success": True,
            "user": {
                "id": user.id,
                "username": user.username,
                "role": user.role
            },
            "message": f"Halo {user.nama_lengkap or user.username}, akses diberikan."
        }


    # =========================================================================
    # 2. SESSION MANAGEMENT
    # =========================================================================
    # Fokus: Mengecek status session yang sedang berjalan di web interface.

    @staticmethod
    def check_session(user_id):
        """Cek apakah session user masih valid dan ambil data terbaru."""
        if not user_id:
            return {"logged_in": False}
            
        user = UserRepository.get_by_id(user_id)
        if not user or not user.aktif:
            return {"logged_in": False}
            
        return {
            "logged_in": True, 
            "username": user.username, 
            "role": user.role, 
            "nama_lengkap": user.nama_lengkap
        }