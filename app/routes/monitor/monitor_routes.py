# app/routes/monitor_routes.py

"""Routes untuk hardware monitoring PC client.

Blueprint ini menyediakan endpoint untuk menerima telemetry
dari C# Hardware Monitor Agent dan menampilkan data metrik
hardware semua PC di dashboard kasir.
"""
from flask import Blueprint, request, jsonify, session
from app.services import HardwareService
from app.utils.helpers import natural_sort_key
from app.utils.logger import write_log
from app.middleware.auth import login_required, admin_required, shift_required
from app.routes.client.client_routes import api_key_required

monitor_api_bp = Blueprint("monitor", __name__)
monitor_kasir_bp = Blueprint("monitor_kasir", __name__)

def _hardware_to_dict(m):
    """Susun satu baris hardware (DB + overlay telemetry RAM + health)."""
    from app.services.cache.memory_store import HardwareMetricsStore
    m_dict = m.to_dict()
    cached = HardwareMetricsStore.get(m.pc_id)
    if cached:
        for k in ["cpu_usage", "cpu_temp", "gpu_temp", "total_ram", "nic_speed", "motherboard", "cpu_name", "gpu_name", "active_window"]:
            if k in cached:
                m_dict[k] = cached[k]
    m_dict["pc_kode"] = m.pc.kode if m.pc else "Unknown"
    m_dict["pc_nama"] = m.pc.nama if m.pc else "Unknown"
    m_dict["pc_grup_id"] = m.pc.grup_id if m.pc else 0
    m_dict["pc_grup_nama"] = m.pc.grup.nama if (m.pc and m.pc.grup) else "Unknown"
    m_dict["health"] = HardwareService.check_pc_warning(m.pc_id, m_dict)
    return m_dict


def _build_hardware_list():
    """Helper untuk memuat dan menyusun metrik hardware semua PC."""
    monitors = HardwareService.get_all_with_pc()
    result = [_hardware_to_dict(m) for m in monitors]

    result.sort(key=lambda item: (item.get("pc_grup_id") or 0, natural_sort_key(item.get("pc_kode", ""))))
    return result


@monitor_api_bp.route("/", methods=["POST"], strict_slashes=False)
@api_key_required
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

        from app.services.settings.settings_service import SettingsService
        polling_interval = SettingsService.get_client_polling_interval()

        return jsonify({
            "success": True, 
            "message": f"Metrics for {pc['kode']} saved",
            "polling_interval": polling_interval
        }), 200

    except ValueError as val_e:
        return jsonify({"error": str(val_e)}), 404
    except Exception as e:
        write_log("MONITOR", f"Error saving telemetry: {str(e)}")
        return jsonify({"error": str(e)}), 500

def _handle_kill_pc_process(pc_id):
    """Helper untuk mengirim perintah kill process ke client PC."""
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
        ClientService.queue_fast_command(pc.id, f"kill:{process_name}")

        operator = session.get("kasir_username", "admin")
        write_log("REMOTE_KILL", f"Perintah Kill Process '{process_name}' dikirim ke PC {pc.kode}", user=operator, detail_json={"pc_kode": pc.kode, "process_name": process_name})
        return jsonify({"success": True, "message": f"Perintah mengakhiri proses {process_name} berhasil dikirim ke {pc.kode}"}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


def _handle_delete_hardware(hardware_id):
    """Helper untuk menghapus data hardware monitor."""
    try:
        pc_kode = HardwareService.delete_hardware(hardware_id, operator="kasir")
        return jsonify({"success": True, "message": f"Data monitor PC {pc_kode} berhasil dibersihkan"}), 200
    except ValueError as val_e:
        return jsonify({"success": False, "error": str(val_e)}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@monitor_kasir_bp.route("/all", methods=["GET"])
@login_required
def get_all_hardware_kasir():
    """Endpoint kasir untuk mengambil semua data hardware monitor beserta data PC ."""
    try:
        return jsonify({"success": True, "data": _build_hardware_list()}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@monitor_kasir_bp.route("/hardware/<int:pc_id>", methods=["GET"])
@login_required
def get_hardware_by_pc(pc_id):
    """Data hardware satu PC untuk modal detail (hindari polling /all)."""
    monitor = HardwareService.get_one_with_pc(pc_id)
    if not monitor:
        return jsonify({"error": "Hardware tidak ditemukan"}), 404
    return jsonify({"success": True, "data": _hardware_to_dict(monitor)}), 200


@monitor_kasir_bp.route("/<int:hardware_id>", methods=["DELETE"])
@login_required
@admin_required
@shift_required
def delete_hardware_data_kasir(hardware_id):
    """Endpoint kasir untuk menghapus data hardware monitor tertentu."""
    return _handle_delete_hardware(hardware_id)


@monitor_kasir_bp.route("/processes/<int:pc_id>", methods=["GET"])
@login_required
@shift_required
def get_pc_processes_kasir(pc_id):
    """Endpoint kasir untuk mengambil daftar proses yang sedang berjalan di PC tertentu."""
    try:
        from datetime import datetime, timezone
        from app.utils.timezone_utils import format_display, display_in_tz, get_tz_short_name
        from app.repositories import HardwareRepository
        from app.services.cache.telemetry_store import ProcessMemoryStore
        processes = HardwareService.get_processes_by_pc(pc_id)
        hw = HardwareRepository.get_by_pc_id(pc_id)

        mem_ts = ProcessMemoryStore.get_last_updated(pc_id)
        db_ts = int(hw.last_update.replace(tzinfo=timezone.utc).timestamp() * 1000) if (hw and hw.last_update) else 0
        last_updated_ts = max(mem_ts or 0, db_ts)

        if mem_ts and mem_ts >= db_ts:
            last_updated_str = format_display(datetime.fromtimestamp(mem_ts / 1000.0, tz=timezone.utc))
        elif hw and hw.last_update:
            last_updated_str = format_display(hw.last_update)
        else:
            last_updated_str = None

        return jsonify({
            "success": True, 
            "data": processes,
            "count": len(processes),
            "last_updated": last_updated_str,
            "last_updated_ts": last_updated_ts
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@monitor_kasir_bp.route("/processes/<int:pc_id>/trigger", methods=["POST"])
@login_required
@shift_required
def trigger_refresh_processes(pc_id):
    """Memicu permintaan pengambilan daftar proses terbaru on-demand ke client PC."""
    try:
        from app.repositories import PCRepository
        pc = PCRepository.get_by_id(pc_id)
        if not pc:
            return jsonify({"success": False, "error": "PC tidak ditemukan"}), 404

        from app.services.client.client_service import ClientService
        ClientService.queue_fast_command(pc.id, "refresh_processes")

        operator = session.get("kasir_username", "admin")
        write_log("REMOTE_REFRESH_PROCESSES_TRIGGER", f"Permintaan Refresh Proses dikirim ke PC {pc.kode}", user=operator, detail_json={"pc_kode": pc.kode})
        return jsonify({"success": True, "message": f"Permintaan pembaruan proses berhasil dikirim ke {pc.kode}"}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@monitor_kasir_bp.route("/processes/<int:pc_id>/kill", methods=["POST"])
@login_required
@admin_required
@shift_required
def kill_pc_process_kasir(pc_id):
    """Trigger request taskkill process ke client PC berdasarkan PC ID."""
    return _handle_kill_pc_process(pc_id)


@monitor_kasir_bp.route("/register/<int:pc_id>", methods=["POST"])
@login_required
@admin_required
@shift_required
def register_pc_hardware(pc_id):
    """Endpoint untuk mendaftarkan hardware saat ini sebagai baseline resmi PC (Update Baseline)."""
    try:
        operator = session.get("kasir_username", "admin")
        pc_kode = HardwareService.update_pc_baseline(pc_id, operator=operator)
        return jsonify({"success": True, "message": f"Baseline hardware PC {pc_kode} berhasil diperbarui"}), 200
    except ValueError as val_e:
        return jsonify({"success": False, "error": str(val_e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# Registrasi sub-modul route terpisah (modular)
from app.routes.monitor.remote_action_routes import register_remote_action_routes
from app.routes.monitor.screenshot_routes import register_screenshot_routes
from app.routes.monitor.vnc_client_routes import register_vnc_client_routes

register_remote_action_routes(monitor_kasir_bp)
register_screenshot_routes(monitor_kasir_bp, monitor_api_bp, natural_sort_key)
register_vnc_client_routes(monitor_kasir_bp)
