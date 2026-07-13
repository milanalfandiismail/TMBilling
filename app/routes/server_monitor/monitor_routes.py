from flask import Blueprint, jsonify
from app.routes.auth.auth_kasir_routes import login_required
import os
import subprocess

server_monitor_bp = Blueprint('server_monitor_api', __name__, url_prefix='/api/v1/kasir')

@server_monitor_bp.route("/server-monitor", methods=["GET"])
@login_required
def get_metrics():
    """Endpoint API utama untuk Server Monitor (menggunakan LHM jika tersedia)."""
    from app.services.server_monitor.server_monitor_service import ServerMonitorService
    try:
        metrics = ServerMonitorService.get_metrics()
        return jsonify({"success": True, "data": metrics}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@server_monitor_bp.route("/server-monitor/lhm/start", methods=["POST"])
@login_required
def start_lhm_service():
    try:
        exe_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "services", "server_monitor", "TMLHMService.exe"))
        if not os.path.exists(exe_path):
            return jsonify({"success": False, "error": f"Executable TMLHMService.exe tidak ditemukan di {exe_path}!"}), 404
            
        cmd = f'Start-Process "{exe_path}" -Verb RunAs -WindowStyle Hidden'
        subprocess.Popen(['powershell', '-NoProfile', '-Command', cmd], creationflags=subprocess.CREATE_NO_WINDOW)
        return jsonify({"success": True, "message": "Permintaan aktivasi LHM Service dikirim. Harap setujui prompt UAC di server."})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@server_monitor_bp.route("/server-monitor/lhm/stop", methods=["POST"])
@login_required
def stop_lhm_service():
    try:
        subprocess.run(['taskkill', '/F', '/IM', 'TMLHMService.exe'], capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW)
        
        tmp_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "tmp"))
        json_path = os.path.join(tmp_dir, "lhm_metrics.json")
        if os.path.exists(json_path):
            try:
                os.remove(json_path)
            except:
                pass
            
        return jsonify({"success": True, "message": "LHM Service dimatikan."})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@server_monitor_bp.route("/server-monitor/lhm/status", methods=["GET"])
@login_required
def status_lhm_service():
    try:
        result = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq TMLHMService.exe'], capture_output=True, text=True, creationflags=subprocess.CREATE_NO_WINDOW)
        is_running = "TMLHMService.exe" in result.stdout
        return jsonify({"success": True, "is_running": is_running})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
