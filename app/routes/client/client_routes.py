# app/routes/client_routes.py

"""Routes untuk komunikasi dengan client C#.

Blueprint ini menangani endpoint yang diakses oleh aplikasi
client di PC warnet, termasuk identifikasi dan polling status.
"""

from flask import Blueprint, request, jsonify, current_app
from app.services import ClientService
from app.utils.logger import write_log
from functools import wraps

client_api_bp = Blueprint("client", __name__)


# =========================================================================
# 1. SECURITY MIDDLEWARE (API KEY VALIDATION)
# =========================================================================
# Fokus: Memastikan request hanya datang dari aplikasi Client C# yang sah.

def api_key_required(f):
    """Decorator untuk validasi header X-Client-Key."""
    @wraps(f)
    def decorated(*args, **kwargs):
        """Wrapper untuk memastikan request memiliki API Key valid."""
        api_key = request.headers.get("X-Client-Key")
        # Ambil key dari config, fallback ke key default jika tidak diset
        expected_key = current_app.config.get("CLIENT_API_KEY")
        
        if not api_key or not expected_key or api_key != expected_key:
            write_log("API_KEY_GAGAL", f"Invalid/Missing API Key from {request.remote_addr}")
            return jsonify({"error": "Akses ditolak. API Key tidak valid atau belum dikonfigurasi"}), 401
        return f(*args, **kwargs)
    return decorated


# =========================================================================
# 2. IDENTIFICATION & HEARTBEAT (POLLING)
# =========================================================================
# Fokus: Proses awal PC nyala (Identify) dan sinkronisasi status rutin (Polling).

@client_api_bp.route("/identify", methods=["POST"])
@api_key_required
def identify():
    """Registrasi/Identifikasi awal PC saat aplikasi Client startup."""
    data = request.get_json() or {}
    role = data.get("role")

    try:
        result = ClientService.identify(
            ip_address=data.get("ip_address"),
            mac_address=data.get("mac_address", "").upper().strip(),
            role=role
        )
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"valid": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"valid": False, "error": f"Internal Error: {str(e)}"}), 500

@client_api_bp.route("/status", methods=["POST"])
@api_key_required
def status():
    """Polling rutin: Cek sisa waktu, status login, dan command auto-shutdown."""
    data = request.get_json() or {}
    role = data.get("role")  # ← ini dapat "admin"

    try:
        result = ClientService.get_status(
            ip_address=data.get("ip_address"),
            mac_address=data.get("mac_address", "").upper().strip(),
            role=role
        )
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Internal Error: {str(e)}"}), 500


# =========================================================================
# 3. SESSION OPERATIONS (TERMINATION & ADMIN)
# =========================================================================
# Fokus: Menutup sesi dari sisi client dan login admin maintenance.

@client_api_bp.route("/selesai", methods=["POST"])
@api_key_required
def selesai():
    """Menutup sesi bermain (Logout) atas permintaan dari Client."""
    data = request.get_json() or {}
    try:
        result = ClientService.tutup_sesi(
            ip_address=data.get("ip_address"),
            mac_address=data.get("mac_address", "").upper().strip()
        )
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Internal Error: {str(e)}"}), 500

@client_api_bp.route("/admin-login", methods=["POST"])
@api_key_required
def admin_login():
    """Login admin langsung di PC client (Bypass Lock Screen)."""
    data = request.get_json() or {}
    try:
        result = ClientService.admin_login(
            ip_address=data.get("ip_address"),
            mac_address=data.get("mac_address", "").upper().strip(),
            username=data.get("username", "").strip(),
            password=data.get("password", "")
        )
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@client_api_bp.route("/emergency-login", methods=["POST"])
@api_key_required
def emergency_login():
    """Login emergency dari PC client (bisa offline/online, selalu diterima)."""
    data = request.get_json() or {}
    try:
        result = ClientService.emergency_login(
            ip_address=data.get("ip_address"),
            mac_address=data.get("mac_address", "").upper().strip()
        )
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@client_api_bp.route("/warnet", methods=["GET"])
@api_key_required
def get_warnet_config():
    """Ambil konfigurasi lengkap Kiosk Client (Judul, Aturan, QRIS, & Paket)."""
    try:
        from app.services import SettingsService
        from app.services import PaketService
        
        title = SettingsService.get("warnet_title", "TMBilling")
        announcement = SettingsService.get("warnet_announcement", "1. Jaga kebersihan dan ketertiban\n2. Dilarang membawa makanan dari luar\n3. Harap matikan PC setelah selesai bermain\n4. Hubungi kasir jika memerlukan bantuan")
        qris_url = SettingsService.get("qris_image_url", "/static/uploads/qris/default_qris.png")
        
        paket = PaketService.get_all(aktif_only=True)
        
        return jsonify({
            "title": title,
            "announcement": announcement,
            "qris_url": qris_url,
            "paket": [p.to_dict() for p in paket]
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500