# app/routes/monitor_routes.py

"""Routes untuk hardware monitoring PC client.

Blueprint ini menyediakan endpoint untuk menerima telemetry
dari C# Hardware Monitor Agent dan menampilkan data metrik
hardware semua PC di dashboard kasir.
"""
from flask import Blueprint, request, jsonify
from app.services.hardware_service import HardwareService
from app.utils.logger import write_log

monitor_bp = Blueprint("monitor", __name__)

@monitor_bp.route("/monitor/all", methods=["GET"])
def get_all_hardware():
    """Endpoint untuk mengambil semua data hardware monitor beserta data PC."""
    try:
        monitors = HardwareService.get_all_with_pc()
        result = []
        for m in monitors:
            m_dict = m.to_dict()
            m_dict["pc_kode"] = m.pc.kode if m.pc else "Unknown"
            m_dict["pc_nama"] = m.pc.nama if m.pc else "Unknown"
            result.append(m_dict)
            
        return jsonify({"success": True, "data": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@monitor_bp.route("/monitor", methods=["POST"])
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

@monitor_bp.route("/monitor/processes/<int:pc_id>", methods=["GET"])
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

@monitor_bp.route("/monitor/<int:hardware_id>", methods=["DELETE"])
def delete_hardware_data(hardware_id):
    """Endpoint untuk menghapus data hardware monitor tertentu secara manual dari dashboard."""
    try:
        pc_kode = HardwareService.delete_hardware(hardware_id, operator="kasir")
        return jsonify({"success": True, "message": f"Data monitor PC {pc_kode} berhasil dibersihkan"}), 200
    except ValueError as val_e:
        return jsonify({"success": False, "error": str(val_e)}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

