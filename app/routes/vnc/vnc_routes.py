# app/routes/vnc/vnc_routes.py
from flask import Blueprint, jsonify, session
from app.services import VNCService
from app.services.settings.settings_service import SettingsService
from app.middleware.auth import admin_required
from app.utils.logger import write_log

vnc_api_bp = Blueprint("vnc", __name__)

@vnc_api_bp.route("/status", methods=["GET"])
@admin_required
def get_vnc_status():
    """Mengecek status VNC Server dan Websockify daemon."""
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
@admin_required
def start_vnc_proxy():
    """Menyalakan proxy Websockify jika VNC Server sudah aktif."""

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


# =========================================================================
# VNC CLIENT REMOTE CONTROL ORCHESTRATION
# =========================================================================

def handle_start_vnc_client(pc_id):
    """Trigger VNC start di client + launch websockify proxy."""
    try:
        from app.repositories import PCRepository
        pc = PCRepository.get_by_id(pc_id)
        if not pc:
            return jsonify({"success": False, "error": "PC tidak ditemukan"}), 404
            
        from app.services.vnc.vnc_service import VNCClientProxyService
        from app.services.settings.settings_service import SettingsService
        from app.services import ClientService
        
        # Cek jika proxy sudah aktif
        active_proxy = VNCClientProxyService.get_proxy(pc.id)
        vnc_password = SettingsService.get("vnc_password", "") or "tmbilling123"
        
        if active_proxy:
            return jsonify({
                "success": True,
                "message": "Remote control sudah aktif",
                "port": active_proxy["port"],
                "token": active_proxy.get("token"),
                "vnc_password": vnc_password,
                "pc_kode": pc.kode
            }), 200
            
        # Reset ready flag
        VNCClientProxyService.reset_vnc_status(pc.id)
        
        # Queue command ke PC
        cmd_payload = {"type": "vnc_start", "vnc_password": vnc_password}
        ClientService.queue_fast_command(pc.id, cmd_payload)
        write_log("VNC_COMMAND_QUEUED", f"Perintah VNC START masuk antrean untuk PC {pc.kode}", detail_json={"pc_id": pc.id})
        
        # Tunggu ready flag dari agent
        success, error_msg = VNCClientProxyService.wait_vnc_ready(pc.id, timeout=25.0)
        if not success:
            write_log("VNC_WAIT_TIMEOUT", f"Gagal mengaktifkan VNC untuk PC {pc.kode} (ID {pc.id}): {error_msg}")
            return jsonify({"success": False, "error": f"PC {pc.kode} gagal mengaktifkan VNC: {error_msg}"}), 408
            
        # Jalankan proxy server
        success, msg, port, token = VNCClientProxyService.start_proxy(pc.id, pc.ip_address)
        if not success:
            return jsonify({"success": False, "error": f"Gagal mengaktifkan proxy server: {msg}"}), 500
            
        operator = session.get("kasir_username", "admin")
        write_log("VNC_CLIENT_START", f"Proxy VNC client PC {pc.kode} dimulai pada port {port}", user=operator, detail_json={"pc_kode": pc.kode, "port": port, "token": token})
        
        return jsonify({
            "success": True,
            "message": "Remote control berhasil disiapkan",
            "port": port,
            "token": token,
            "vnc_password": vnc_password,
            "pc_kode": pc.kode
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


def handle_stop_vnc_client(pc_id):
    """Matikan proxy VNC server dan kirim command stop ke PC Client."""
    try:
        from app.repositories import PCRepository
        pc = PCRepository.get_by_id(pc_id)
        if not pc:
            return jsonify({"success": False, "error": "PC tidak ditemukan"}), 404
            
        from app.services.vnc.vnc_service import VNCClientProxyService
        from app.services import ClientService
        
        VNCClientProxyService.stop_proxy(pc.id)
        ClientService.queue_fast_command(pc.id, "vnc_stop")
        
        operator = session.get("kasir_username", "admin")
        write_log("VNC_CLIENT_STOP", f"Proxy VNC client PC {pc.kode} dihentikan", user=operator, detail_json={"pc_kode": pc.kode})
        
        return jsonify({"success": True, "message": "Remote control berhasil dihentikan"}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


def handle_status_vnc_client(pc_id):
    """Mendapatkan status proxy VNC aktif untuk PC client."""
    try:
        from app.services.vnc.vnc_service import VNCClientProxyService
        proxy = VNCClientProxyService.get_proxy(pc_id)
        if proxy:
            return jsonify({
                "success": True,
                "active": True,
                "port": proxy["port"],
                "client_ip": proxy["client_ip"]
            }), 200
        else:
            return jsonify({
                "success": True,
                "active": False
            }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@vnc_api_bp.route("/client/<int:pc_id>/start", methods=["POST"])
@admin_required
def start_vnc_client_route(pc_id):
    return handle_start_vnc_client(pc_id)


@vnc_api_bp.route("/client/<int:pc_id>/stop", methods=["POST"])
@admin_required
def stop_vnc_client_route(pc_id):
    return handle_stop_vnc_client(pc_id)


@vnc_api_bp.route("/client/<int:pc_id>/status", methods=["GET"])
@admin_required
def status_vnc_client_route(pc_id):
    return handle_status_vnc_client(pc_id)
