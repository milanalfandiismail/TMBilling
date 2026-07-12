# app/routes/monitor_routes.py

"""Routes untuk hardware monitoring PC client.

Blueprint ini menyediakan endpoint untuk menerima telemetry
dari C# Hardware Monitor Agent dan menampilkan data metrik
hardware semua PC di dashboard kasir.
"""
from flask import Blueprint, request, jsonify
from app.services import HardwareService
from app.utils.logger import write_log
from app.routes.auth.auth_kasir_routes import login_required
from app.routes.client.client_routes import api_key_required

monitor_api_bp = Blueprint("monitor", __name__)
monitor_kasir_bp = Blueprint("monitor_kasir", __name__)

@monitor_api_bp.route("/all", methods=["GET"])
def get_all_hardware():
    """Endpoint untuk mengambil semua data hardware monitor beserta data PC."""
    try:
        monitors = HardwareService.get_all_with_pc()
        result = []
        for m in monitors:
            m_dict = m.to_dict()
            m_dict["pc_kode"] = m.pc.kode if m.pc else "Unknown"
            m_dict["pc_nama"] = m.pc.nama if m.pc else "Unknown"
            # Evaluasi warning status secara real-time in-memory
            m_dict["health"] = HardwareService.check_pc_warning(m.pc_id, m_dict)
            result.append(m_dict)
            
        return jsonify({"success": True, "data": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@monitor_api_bp.route("/", methods=["POST"], strict_slashes=False)
def receive_hardware_data():
    """Endpoint untuk menerima data telemetry dari Hardware Monitor Agent (C#).
    
    Data dicocokkan dengan tabel PC menggunakan IP Address remote agent tersebut.
    Jika cocok, metrik CPU/GPU dll akan disimpan ke database tabel HardwareMonitor.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON payload provided"}), 400

        client_ip = request.remote_addr
        pc = HardwareService.process_hardware_metric(client_ip, data)

        return jsonify({"success": True, "message": f"Metrics for {pc.kode} saved"}), 200

    except ValueError as val_e:
        return jsonify({"error": str(val_e)}), 404
    except Exception as e:
        write_log("MONITOR", f"Error saving telemetry: {str(e)}")
        return jsonify({"error": str(e)}), 500

@monitor_api_bp.route("/processes/<int:pc_id>", methods=["GET"])
def get_pc_processes(pc_id):
    """Endpoint untuk mengambil daftar proses yang sedang berjalan di PC tertentu."""
    try:
        processes = HardwareService.get_processes_by_pc(pc_id)
        return jsonify({
            "success": True, 
            "data": processes,
            "count": len(processes)
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@monitor_api_bp.route("/processes/<int:pc_id>/kill", methods=["POST"])
@login_required
def kill_pc_process(pc_id):
    """Trigger request taskkill process ke client PC berdasarkan PC ID."""
    try:
        data = request.get_json() or {}
        process_name = data.get("process_name")
        if not process_name:
            return jsonify({"success": False, "error": "Nama proses harus diisi"}), 400

        from app.repositories import PCRepository
        pc = PCRepository.get_by_id(pc_id)
        if not pc:
            return jsonify({"success": False, "error": "PC tidak ditemukan"}), 404

        from app.services.client.client_service import ClientService
        ClientService.queue_command(pc.id, f"kill:{process_name}")

        write_log("REMOTE_KILL", f"Perintah Kill Process '{process_name}' dikirim ke PC {pc.kode}")
        return jsonify({"success": True, "message": f"Perintah mengakhiri proses {process_name} berhasil dikirim ke {pc.kode}"}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@monitor_api_bp.route("/<int:hardware_id>", methods=["DELETE"])
def delete_hardware_data(hardware_id):
    """Endpoint untuk menghapus data hardware monitor tertentu secara manual dari dashboard."""
    try:
        pc_kode = HardwareService.delete_hardware(hardware_id, operator="kasir")
        return jsonify({"success": True, "message": f"Data monitor PC {pc_kode} berhasil dibersihkan"}), 200
    except ValueError as val_e:
        return jsonify({"success": False, "error": str(val_e)}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@monitor_kasir_bp.route("/screenshot/trigger/<int:pc_id>", methods=["POST"])
@login_required
def trigger_screenshot(pc_id):
    """Trigger request screenshot ke client PC berdasarkan PC ID."""
    try:
        from app.repositories import PCRepository
        pc = PCRepository.get_by_id(pc_id)
        if not pc:
            return jsonify({"success": False, "error": "PC tidak ditemukan"}), 404

        from app.services import ClientService
        ClientService.queue_command(pc.id, "screenshot")

        return jsonify({"success": True, "message": f"Perintah screenshot berhasil dikirim ke {pc.kode}"}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
@monitor_kasir_bp.route("/remote/<int:pc_id>/<string:action>", methods=["POST"])
@login_required
def trigger_remote_action(pc_id, action):
    """Trigger remote action (shutdown atau restart) ke client PC berdasarkan PC ID."""
    try:
        if action not in ["shutdown", "restart"]:
            return jsonify({"success": False, "error": "Aksi tidak valid"}), 400

        from app.repositories import PCRepository
        pc = PCRepository.get_by_id(pc_id)
        if not pc:
            return jsonify({"success": False, "error": "PC tidak ditemukan"}), 404

        from app.services import ClientService
        ClientService.queue_command(pc.id, action)

        action_label = "Shutdown" if action == "shutdown" else "Restart"
        write_log("REMOTE_ACTION", f"Perintah {action_label} dikirim ke PC {pc.kode}")
        return jsonify({"success": True, "message": f"Perintah {action_label} berhasil dikirim ke {pc.kode}"}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@monitor_api_bp.route("/screenshot/upload", methods=["POST"])
@api_key_required
def upload_screenshot():
    """Endpoint bagi client PC untuk mengunggah tangkapan layar (screenshot) terbaru."""
    try:
        import os
        from flask import current_app
        from app.repositories import PCRepository

        client_ip = request.headers.get("X-IP-Address") or request.remote_addr
        pc = PCRepository.get_by_ip(client_ip)
        if not pc:
            return jsonify({"error": "IP PC tidak dikenal"}), 404

        # Ambil raw binary data dari body POST
        image_data = request.data
        if not image_data:
            return jsonify({"error": "Data gambar kosong"}), 400

        # Folder upload: app/static/uploads/screenshots/
        upload_folder = os.path.join(current_app.root_path, 'static', 'uploads', 'screenshots')
        if not os.path.exists(upload_folder):
            os.makedirs(upload_folder, exist_ok=True)

        # Simpan sebagai {kode_pc}.png
        file_path = os.path.join(upload_folder, f"{pc.kode}.png")
        with open(file_path, "wb") as f:
            f.write(image_data)

        write_log("SCREENSHOT_UPLOAD", f"Screenshot PC {pc.kode} berhasil disimpan")
        return jsonify({"success": True, "message": "Screenshot berhasil diunggah"}), 200
    except Exception as e:
        write_log("SCREENSHOT_UPLOAD_ERROR", f"Gagal simpan screenshot: {str(e)}")
        return jsonify({"error": str(e)}), 500


@monitor_kasir_bp.route("/screenshot/status/<int:pc_id>", methods=["GET"])
@login_required
def get_screenshot_status(pc_id):
    """Mengecek status dan timestamp screenshot terakhir untuk PC tertentu."""
    try:
        import os
        from flask import current_app
        from app.repositories import PCRepository
        from datetime import datetime

        pc = PCRepository.get_by_id(pc_id)
        if not pc:
            return jsonify({"success": False, "error": "PC tidak ditemukan"}), 404

        screenshot_path = os.path.join(current_app.root_path, 'static', 'uploads', 'screenshots', f"{pc.kode}.png")
        if os.path.exists(screenshot_path):
            mtime = os.path.getmtime(screenshot_path)
            screenshot_time = datetime.fromtimestamp(mtime).strftime("%d/%m/%Y %H:%M:%S")
            return jsonify({
                "success": True,
                "screenshot_url": f"/static/uploads/screenshots/{pc.kode}.png",
                "screenshot_time": screenshot_time
            }), 200
        else:
            return jsonify({
                "success": True,
                "screenshot_url": None,
                "screenshot_time": None
            }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@monitor_kasir_bp.route("/screenshot/all", methods=["GET"])
@login_required
def get_all_screenshot_status():
    """Mengecek status dan timestamp screenshot terakhir untuk semua PC."""
    try:
        import os
        from flask import current_app
        from app.repositories import PCRepository
        from datetime import datetime

        pcs = PCRepository.get_all()
        result = []

        for pc in pcs:
            screenshot_path = os.path.join(current_app.root_path, 'static', 'uploads', 'screenshots', f"{pc.kode}.png")
            if os.path.exists(screenshot_path):
                mtime = os.path.getmtime(screenshot_path)
                screenshot_time = datetime.fromtimestamp(mtime).strftime("%d/%m/%Y %H:%M:%S")
                result.append({
                    "pc_id": pc.id,
                    "pc_kode": pc.kode,
                    "pc_grup_nama": pc.grup.nama if pc.grup else "Unknown",                    "screenshot_url": f"/static/uploads/screenshots/{pc.kode}.png",
                    "screenshot_time": screenshot_time
                })
            else:
                result.append({
                    "pc_id": pc.id,
                    "pc_kode": pc.kode,
                    "pc_grup_nama": pc.grup.nama if pc.grup else "Unknown",                    "screenshot_url": None,
                    "screenshot_time": None
                })
                
        return jsonify({"success": True, "data": result}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

