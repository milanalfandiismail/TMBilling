# app/routes/auth_kasir_routes.py

"""Routes untuk autentikasi kasir/admin web.

Blueprint ini menangani login/logout untuk user dashboard kasir
serta menyediakan decorator untuk proteksi endpoint.
"""

from flask import Blueprint, request, jsonify, session, redirect
from app.services.auth_kasir_service import AuthKasirService
from functools import wraps

auth_kasir_bp = Blueprint("auth_kasir", __name__)


# =========================================================================
# 1. MIDDLEWARE / DECORATORS (SECURITY GUARDS)
# =========================================================================
# Fokus: Fungsi pembantu untuk memproteksi route agar hanya bisa diakses user login.

def login_required(f):
    """Decorator untuk proteksi endpoint API JSON (Return 401)."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        """Wrapper untuk validasi session API."""
        kasir_id = session.get("kasir_id")
        if not kasir_id:
            return jsonify({"error": "Silakan login terlebih dahulu"}), 401
            
        from app.repositories.user_repository import UserRepository
        user = UserRepository.get_by_id(kasir_id)
        if not user or not user.aktif:
            # Bersihkan session jika tidak valid
            session.pop("kasir_id", None)
            session.pop("kasir_username", None)
            session.pop("kasir_role", None)
            session.pop("kasir_nama", None)
            return jsonify({"error": "Sesi tidak valid, silakan login kembali"}), 401
            
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    """Decorator khusus Admin. Wajib pasang @login_required sebelumnya."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if session.get("kasir_role") != "admin":
            return jsonify({"error": "Akses Ditolak. Hanya Admin yang diizinkan."}), 403
        return f(*args, **kwargs)
    return decorated_function

def login_required_html(f):
    """Decorator untuk proteksi endpoint Halaman HTML (Redirect ke Login)."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        """Wrapper untuk validasi session HTML."""
        kasir_id = session.get("kasir_id")
        if not kasir_id:
            return redirect("/kasir/login")
            
        from app.repositories.user_repository import UserRepository
        user = UserRepository.get_by_id(kasir_id)
        if not user or not user.aktif:
            # Bersihkan session jika tidak valid
            session.pop("kasir_id", None)
            session.pop("kasir_username", None)
            session.pop("kasir_role", None)
            session.pop("kasir_nama", None)
            return redirect("/kasir/login")
            
        return f(*args, **kwargs)
    return decorated_function


# =========================================================================
# 2. AUTHENTICATION ENDPOINTS (LOGIN/LOGOUT)
# =========================================================================
# Fokus: Menangani alur masuk/keluar user dan pengelolaan session Flask.

@auth_kasir_bp.route("/login", methods=["POST"])
def login():
    """Login kasir/admin dan inisialisasi session."""
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    try:
        result = AuthKasirService.login(username, password)

        # Inisialisasi Session Flask
        session["kasir_id"] = result["user"]["id"]
        session["kasir_username"] = result["user"]["username"]
        session["kasir_role"] = result["user"]["role"]
        session["kasir_nama"] = result["user"].get("nama_lengkap")

        return jsonify(result), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 401
    except Exception as e:
        return jsonify({"error": f"Terjadi kesalahan: {str(e)}"}), 500

@auth_kasir_bp.route("/logout", methods=["POST"])
@login_required
def logout():
    """Logout kasir dan membersihkan session."""
    username = session.get("kasir_username", "kasir")

    try:
        result = AuthKasirService.logout(username)

        # Hapus Session secara total
        session.pop("kasir_id", None)
        session.pop("kasir_username", None)
        session.pop("kasir_role", None)
        session.pop("kasir_nama", None)

        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": f"Terjadi kesalahan: {str(e)}"}), 500


# =========================================================================
# 3. SESSION & SPECIAL VALIDATION (STATUS CHECK)
# =========================================================================
# Fokus: Mengecek status session aktif dan validasi admin khusus (Client side).

@auth_kasir_bp.route("/check", methods=["GET"])
def check_session():
    """Cek status login untuk kebutuhan UI Frontend."""
    kasir_id = session.get("kasir_id")
    result = AuthKasirService.check_session(user_id=kasir_id)
    if not result.get("logged_in"):
        # Bersihkan session jika tidak valid
        session.pop("kasir_id", None)
        session.pop("kasir_username", None)
        session.pop("kasir_role", None)
        session.pop("kasir_nama", None)
    return jsonify(result), 200

@auth_kasir_bp.route("/admin-check", methods=["POST"])
def admin_check():
    """Endpoint khusus validasi admin (Ctrl+Q Bypass di client PC)."""
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")
    
    try:
        result = AuthKasirService.validate_admin(username, password)
        return jsonify(result), 200
    except ValueError as e:
        status_code = 401
        if "Akses ditolak" in str(e):
            status_code = 403
        return jsonify({"success": False, "error": str(e)}), status_code
    except Exception as e:
        return jsonify({"success": False, "error": f"Internal Server Error: {str(e)}"}), 500