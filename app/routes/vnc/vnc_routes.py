# app/routes/vnc/vnc_routes.py
from flask import Blueprint, jsonify, session
from app.services import VNCService
from app.services.settings.settings_service import SettingsService
from app.utils.logger import write_log

vnc_api_bp = Blueprint("vnc", __name__)

@vnc_api_bp.route("/status", methods=["GET"])
def get_vnc_status():
    """Mengecek status VNC Server dan Websockify daemon."""
    if session.get("kasir_role") != "admin":
        return jsonify({"success": False, "error": "Akses ditolak"}), 403

    vnc_active = VNCService.is_vnc_server_active()
    ws_active = VNCService.is_websockify_active()

    return jsonify({
        "success": True,
        "data": {
            "vnc_server_active": vnc_active,
            "websockify_active": ws_active,
            "listen_port": VNCService.LISTEN_PORT
        }
    })

@vnc_api_bp.route("/start", methods=["POST"])
def start_vnc_proxy():
    """Menyalakan proxy Websockify jika VNC Server sudah aktif."""
    if session.get("kasir_role") != "admin":
        return jsonify({"success": False, "error": "Akses ditolak"}), 403

    success, msg = VNCService.ensure_websockify_running()
    operator = session.get("kasir_username", "admin")
    write_log(
        "VNC_START",
        f"Proxy Websockify VNC dijalankan pada port {VNCService.LISTEN_PORT} ({msg})",
        user=operator,
        detail_json={"listen_port": VNCService.LISTEN_PORT, "status": success, "message": msg}
    )

    vnc_password = SettingsService.get("vnc_password", "")

    if not success:
        return jsonify({"success": False, "error": msg, "vnc_password": vnc_password}), 400

    return jsonify({
        "success": True,
        "message": msg,
        "listen_port": VNCService.LISTEN_PORT,
        "token": "server",
        "vnc_password": vnc_password
    })

