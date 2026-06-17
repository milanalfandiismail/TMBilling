# app/routes/auth_routes.py

"""Routes untuk autentikasi client C#.

Blueprint ini menangani request login, logout, dan pengecekan status
langsung dari aplikasi PC client warnet.
"""

from flask import Blueprint, request, jsonify
from app.services import AuthService
from app.utils.logger import write_log

auth_bp = Blueprint("auth", __name__)


# =========================================================================
# 1. SESSION CONTROL (LOGIN / LOGOUT)
# =========================================================================
# Fokus: Menangani alur masuk dan keluar member di PC client.

@auth_bp.route("/login", methods=["POST"])
def login():
    """Login member dari PC client dengan validasi IP & MAC."""
    data = request.get_json() or {}
    try:
        result = AuthService.login(
            username=data.get("username", "").strip(),
            password=data.get("password", ""),
            ip_address=data.get("ip_address"),
            mac_address=data.get("mac_address", "").upper().strip()
        )
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Server Error: {str(e)}"}), 500


@auth_bp.route("/logout", methods=["POST"])
def logout():
    """Logout member dan membersihkan sesi di database."""
    data = request.get_json() or {}
    try:
        result = AuthService.logout(
            ip_address=data.get("ip_address"),
            mac_address=data.get("mac_address", "").upper().strip(),
            token_sesi=data.get("token_sesi")
        )
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        # Logging internal untuk error yang tidak terduga
        write_log("LOGOUT_ERROR", f"Logout error: {str(e)}") 
        return jsonify({"error": f"Server Error: {str(e)}"}), 500


# =========================================================================
# 2. STATUS & HEALTH CHECK
# =========================================================================
# Fokus: Memberikan info ke aplikasi client mengenai kondisi PC saat ini.

@auth_bp.route("/status", methods=["POST"])
def status():
    """Cek status PC (kosong/terpakai) berdasarkan identitas hardware."""
    data = request.get_json() or {}
    try:
        result = AuthService.get_status(
            ip_address=data.get("ip_address"),
            mac_address=data.get("mac_address", "").upper().strip()
        )
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Server Error: {str(e)}"}), 500