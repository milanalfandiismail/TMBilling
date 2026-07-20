# app/routes/auth_kasir_routes.py

"""Routes untuk autentikasi kasir/admin web.

Blueprint ini menangani login/logout untuk user dashboard kasir
serta menyediakan decorator untuk proteksi endpoint.
"""

from flask import Blueprint, request, jsonify, session
from app.services import AuthKasirService
from app.utils.logger import write_log
from app.middleware.auth import login_required, admin_required, login_required_html, clear_kasir_session

auth_kasir_api_bp = Blueprint("auth_kasir", __name__)


# =========================================================================
# 2. AUTHENTICATION ENDPOINTS (LOGIN/LOGOUT)
# =========================================================================
# Fokus: Menangani alur masuk/keluar user dan pengelolaan session Flask.

@auth_kasir_api_bp.route("/login", methods=["POST"])
def login():
    """Login kasir/admin dan inisialisasi session."""
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    # Validasi kredensial dulu (tanpa log) untuk dapatkan role
    pre_user = AuthKasirService.validate_credentials_only(username, password)
    if not pre_user:
        return jsonify({"error": "Username atau password salah"}), 401

    # Non-admin harus login dari IP whitelisted (kecuali bypass token)
    if pre_user.role != "admin":
        try:
            from app.services.ip_whitelist.ip_whitelist_service import IpWhitelistService
            if IpWhitelistService.is_enabled() and not IpWhitelistService.is_session_authenticated():
                client_ip = IpWhitelistService.get_client_ip()
                if not IpWhitelistService.is_ip_whitelisted(client_ip):
                    write_log("LOGIN_GAGAL",
                              f"Username:{username} - IP {client_ip} tidak di whitelist")
                    return jsonify({
                        "error": "Akses Anda dibatasi.",
                        "detail": f"IP {client_ip} tidak diizinkan mengakses dashboard kasir. "
                                   f"Hubungi admin untuk mendaftarkan IP Anda."
                    }), 403
        except Exception:
            pass

    try:
        result = AuthKasirService.login(username, password)

        role = result["user"]["role"]

        # Admin login dari IP baru → auto-add ke whitelist
        if role == "admin":
            try:
                from app.services.ip_whitelist.ip_whitelist_service import IpWhitelistService
                client_ip = IpWhitelistService.get_client_ip()
                if IpWhitelistService.is_enabled() and not IpWhitelistService.is_ip_whitelisted(client_ip):
                    IpWhitelistService.add(client_ip, 'Auto (login)')
            except Exception:
                pass

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

@auth_kasir_api_bp.route("/logout", methods=["POST"])
@login_required
def logout():
    """Logout kasir dan membersihkan session."""
    username = session.get("kasir_username", "kasir")

    try:
        result = AuthKasirService.logout(username)

        # Hapus Session secara total (DRY)
        clear_kasir_session()

        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": f"Terjadi kesalahan: {str(e)}"}), 500


# =========================================================================
# 3. SESSION & SPECIAL VALIDATION (STATUS CHECK)
# =========================================================================
# Fokus: Mengecek status session aktif dan validasi admin khusus (Client side).

@auth_kasir_api_bp.route("/check", methods=["GET"])
def check_session():
    """Cek status login untuk kebutuhan UI Frontend."""
    kasir_id = session.get("kasir_id")
    result = AuthKasirService.check_session(user_id=kasir_id)

    # Jika session valid, cek juga IP whitelist
    if result.get("logged_in"):
        try:
            from app.services.ip_whitelist.ip_whitelist_service import IpWhitelistService
            if IpWhitelistService.is_enabled() and not IpWhitelistService.is_session_authenticated():
                client_ip = IpWhitelistService.get_client_ip()
                if not IpWhitelistService.is_ip_whitelisted(client_ip):
                    result = {"logged_in": False, "reason": "ip_not_whitelisted"}
        except Exception:
            pass

    if not result.get("logged_in"):
        # Bersihkan session jika tidak valid (DRY)
        clear_kasir_session()
    return jsonify(result), 200

@auth_kasir_api_bp.route("/admin-check", methods=["POST"])
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