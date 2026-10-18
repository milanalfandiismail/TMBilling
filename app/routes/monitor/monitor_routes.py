# app/routes/monitor_routes.py

"""Routes untuk hardware monitoring PC client.

Blueprint ini menyediakan endpoint untuk menerima telemetry
dari C# Hardware Monitor Agent dan menampilkan data metrik
hardware semua PC di dashboard kasir.
"""
from flask import Blueprint, request, jsonify, session
import re
from app.services import HardwareService
from app.utils.logger import write_log
from app.middleware.auth import login_required, admin_required, shift_required
from app.routes.client.client_routes import api_key_required

monitor_api_bp = Blueprint("monitor", __name__)
monitor_kasir_bp = Blueprint("monitor_kasir", __name__)

def natural_sort_key(s):
    """Helper untuk natural alphanumeric sorting (misal: TM-1, TM-2, TM-10)."""
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s or '')]


@monitor_api_bp.route("/all", methods=["GET"])
@login_required
def get_all_hardware():
    """Endpoint untuk mengambil semua data hardware monitor beserta data PC."""
    try:
        monitors = HardwareService.get_all_with_pc()
        result = []
        for m in monitors:
            m_dict = m.to_dict()
            m_dict["pc_kode"] = m.pc.kode if m.pc else "Unknown"
            m_dict["pc_nama"] = m.pc.nama if m.pc else "Unknown"
            m_dict["pc_grup_id"] = m.pc.grup_id if m.pc else 0
            m_dict["pc_grup_nama"] = m.pc.grup.nama if (m.pc and m.pc.grup) else "Unknown"
            # Evaluasi warning status secara real-time in-memory
            m_dict["health"] = HardwareService.check_pc_warning(m.pc_id, m_dict)
            result.append(m_dict)
            
        # Urutkan hasil secara natural berdasarkan grup dan kode PC
        result.sort(key=lambda item: (item.get("pc_grup_id") or 0, natural_sort_key(item.get("pc_kode", ""))))
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

        from app.services.settings.settings_service import SettingsService
        polling_interval = SettingsService.get_client_polling_interval()

        return jsonify({
            "success": True, 
            "message": f"Metrics for {pc.kode} saved",
            "polling_interval": polling_interval
        }), 200

    except ValueError as val_e:
        return jsonify({"error": str(val_e)}), 404
    except Exception as e:
        write_log("MONITOR", f"Error saving telemetry: {str(e)}")
        return jsonify({"error": str(e)}), 500

@monitor_api_bp.route("/processes/<int:pc_id>", methods=["GET"])
@login_required
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
@admin_required
@shift_required
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
        ClientService.queue_fast_command(pc.id, f"kill:{process_name}")

        operator = session.get("kasir_username", "admin")
        write_log("REMOTE_KILL", f"Perintah Kill Process '{process_name}' dikirim ke PC {pc.kode}", user=operator, detail_json={"pc_kode": pc.kode, "process_name": process_name})
        return jsonify({"success": True, "message": f"Perintah mengakhiri proses {process_name} berhasil dikirim ke {pc.kode}"}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@monitor_api_bp.route("/<int:hardware_id>", methods=["DELETE"])
@login_required
@admin_required
@shift_required
def delete_hardware_data(hardware_id):
    """Endpoint untuk menghapus data hardware monitor tertentu secara manual dari dashboard."""
    try:
        pc_kode = HardwareService.delete_hardware(hardware_id, operator="kasir")
        return jsonify({"success": True, "message": f"Data monitor PC {pc_kode} berhasil dibersihkan"}), 200
    except ValueError as val_e:
        return jsonify({"success": False, "error": str(val_e)}), 404
@monitor_kasir_bp.route("/all", methods=["GET"])
@login_required
def get_all_hardware_kasir():
    """Endpoint kasir untuk mengambil semua data hardware monitor beserta data PC (relayed via multi-branch)."""
    try:
        monitors = HardwareService.get_all_with_pc()
        result = []
        for m in monitors:
            m_dict = m.to_dict()
            m_dict["pc_kode"] = m.pc.kode if m.pc else "Unknown"
            m_dict["pc_nama"] = m.pc.nama if m.pc else "Unknown"
            m_dict["pc_grup_id"] = m.pc.grup_id if m.pc else 0
            m_dict["pc_grup_nama"] = m.pc.grup.nama if (m.pc and m.pc.grup) else "Unknown"
            m_dict["health"] = HardwareService.check_pc_warning(m.pc_id, m_dict)
            result.append(m_dict)
            
        # Urutkan hasil secara natural berdasarkan grup dan kode PC
        result.sort(key=lambda item: (item.get("pc_grup_id") or 0, natural_sort_key(item.get("pc_kode", ""))))
        return jsonify({"success": True, "data": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@monitor_kasir_bp.route("/<int:hardware_id>", methods=["DELETE"])
@login_required
@admin_required
@shift_required
def delete_hardware_data_kasir(hardware_id):
    """Endpoint kasir untuk menghapus data hardware monitor tertentu."""
    try:
        pc_kode = HardwareService.delete_hardware(hardware_id, operator="kasir")
        return jsonify({"success": True, "message": f"Data monitor PC {pc_kode} berhasil dibersihkan"}), 200
    except ValueError as val_e:
        return jsonify({"success": False, "error": str(val_e)}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@monitor_kasir_bp.route("/processes/<int:pc_id>", methods=["GET"])
@login_required
@shift_required
def get_pc_processes_kasir(pc_id):
    """Endpoint kasir untuk mengambil daftar proses yang sedang berjalan di PC tertentu."""
    try:
        from datetime import timezone
        from app.utils.timezone_utils import format_display, display_in_tz, get_tz_short_name
        from app.repositories import HardwareRepository
        processes = HardwareService.get_processes_by_pc(pc_id)
        hw = HardwareRepository.get_by_pc_id(pc_id)
        
        last_updated_ts = int(hw.last_update.replace(tzinfo=timezone.utc).timestamp() * 1000) if (hw and hw.last_update) else 0
        last_updated_str = format_display(hw.last_update) if (hw and hw.last_update) else None

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


@monitor_kasir_bp.route("/screenshot/trigger/<int:pc_id>", methods=["POST"])
@login_required
@admin_required
@shift_required
def trigger_screenshot(pc_id):
    """Trigger request screenshot ke client PC berdasarkan PC ID."""
    try:
        from app.repositories import PCRepository
        pc = PCRepository.get_by_id(pc_id)
        if not pc:
            return jsonify({"success": False, "error": "PC tidak ditemukan"}), 404

        from app.services import ClientService
        ClientService.queue_command(pc.id, "screenshot")

        operator = session.get("kasir_username", "admin")
        write_log("REMOTE_SCREENSHOT_TRIGGER", f"Permintaan Screenshot dikirim ke PC {pc.kode}", user=operator, detail_json={"pc_kode": pc.kode})
        return jsonify({"success": True, "message": f"Perintah screenshot berhasil dikirim ke {pc.kode}"}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
@monitor_kasir_bp.route("/remote/<int:pc_id>/afk-lock", methods=["POST"])
@login_required
@admin_required
@shift_required
def trigger_remote_afk_lock(pc_id):
    """Trigger remote AFK lock ke PC client dari Kasir dengan PIN."""
    try:
        from app.repositories import PCRepository, SesiRepository
        from app.models import db, now_local
        from app.services import ClientService
        from werkzeug.security import generate_password_hash

        data = request.get_json() or {}
        pin = str(data.get("pin", "")).strip()
        if not pin:
            return jsonify({"success": False, "error": "PIN / Password kunci layar tidak boleh kosong"}), 400

        pc = PCRepository.get_by_id(pc_id)
        if not pc:
            return jsonify({"success": False, "error": "PC tidak ditemukan"}), 404

        sesi = SesiRepository.get_aktif_by_pc(pc.id)
        if not sesi:
            return jsonify({"success": False, "error": "Tidak ada sesi aktif di PC ini"}), 400

        sesi.is_afk = True
        sesi.afk_pin = generate_password_hash(pin)
        sesi.afk_sejak = now_local()
        db.session.commit()

        ClientService.queue_command(pc.id, "afk_lock")
        operator = session.get("kasir_username", "admin")
        write_log("REMOTE_AFK_LOCK", f"PC {pc.kode} dikunci AFK secara remote oleh kasir dengan PIN", user=operator, detail_json={"pc_kode": pc.kode, "sesi_id": sesi.id})
        return jsonify({"success": True, "message": f"Perintah kunci AFK berhasil dikirim ke {pc.kode}"}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@monitor_kasir_bp.route("/remote/<int:pc_id>/afk-unlock", methods=["POST"])
@login_required
@admin_required
@shift_required
def trigger_remote_afk_unlock(pc_id):
    """Trigger master unlock AFK ke PC client dari Kasir."""
    try:
        from app.repositories import PCRepository, SesiRepository
        from app.models import db
        from app.services import ClientService

        pc = PCRepository.get_by_id(pc_id)
        if not pc:
            return jsonify({"success": False, "error": "PC tidak ditemukan"}), 404

        sesi = SesiRepository.get_aktif_by_pc(pc.id)
        if not sesi:
            return jsonify({"success": False, "error": "Tidak ada sesi aktif di PC ini"}), 400

        sesi.is_afk = False
        sesi.afk_pin = None
        sesi.afk_sejak = None
        db.session.commit()

        ClientService.queue_command(pc.id, "afk_unlock")
        operator = session.get("kasir_username", "admin")
        write_log("REMOTE_AFK_UNLOCK", f"PC {pc.kode} dibuka kunci AFK secara remote (Master Unlock) oleh kasir", user=operator, detail_json={"pc_kode": pc.kode, "sesi_id": sesi.id})
        return jsonify({"success": True, "message": f"Kunci AFK PC {pc.kode} berhasil dibuka oleh kasir"}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@monitor_kasir_bp.route("/remote/<int:pc_id>/<string:action>", methods=["POST"])
@login_required
@admin_required
@shift_required
def trigger_remote_action(pc_id, action):
    """Trigger remote action (shutdown atau restart) ke client PC berdasarkan PC ID."""
    try:
        if action not in ["shutdown", "restart"]:
            return jsonify({"success": False, "error": "Aksi tidak valid"}), 400

        from app.repositories import PCRepository, SesiRepository
        pc = PCRepository.get_by_id(pc_id)
        if not pc:
            return jsonify({"success": False, "error": "PC tidak ditemukan"}), 404

        # Cegah aksi operasional (shutdown/restart) jika PC sedang dalam sesi SYSTEM
        sesi = SesiRepository.get_aktif_by_pc(pc.id)
        is_system = pc.is_admin_mode and sesi and (sesi.nama_guest or "").strip().upper() == "SYSTEM"
        if is_system:
            return jsonify({"success": False, "error": "Aksi operasional (Restart/Shutdown) tidak diizinkan pada PC dalam mode SYSTEM"}), 403

        from app.services import ClientService
        ClientService.queue_command(pc.id, action)

        action_label = "Shutdown" if action == "shutdown" else "Restart"
        operator = session.get("kasir_username", "admin")
        write_log("REMOTE_ACTION", f"Perintah {action_label} dikirim ke PC {pc.kode}", user=operator, detail_json={"pc_kode": pc.kode, "action": action})
        return jsonify({"success": True, "message": f"Perintah {action_label} berhasil dikirim ke {pc.kode}"}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@monitor_kasir_bp.route("/remote/batch", methods=["POST"])
@login_required
@admin_required
@shift_required
def trigger_remote_action_batch():
    """Trigger remote action (shutdown atau restart) ke banyak PC client sekaligus."""
    try:
        data = request.get_json() or {}
        pc_ids = data.get("pc_ids") or []
        action = data.get("action")

        if action not in ["shutdown", "restart"]:
            return jsonify({"success": False, "error": "Aksi tidak valid (hanya shutdown/restart)"}), 400
        if not pc_ids or not isinstance(pc_ids, list):
            return jsonify({"success": False, "error": "Daftar PC (pc_ids) harus berupa array non-kosong"}), 400

        from app.repositories import PCRepository, SesiRepository
        from app.services import ClientService

        action_label = "Shutdown" if action == "shutdown" else "Restart"
        operator = session.get("kasir_username", "admin")
        success_list = []
        errors = []

        for pc_id in pc_ids:
            pc = PCRepository.get_by_id(pc_id)
            if not pc:
                errors.append({"pc_id": pc_id, "error": "PC tidak ditemukan"})
                continue
            
            # Skip jika PC dalam mode SYSTEM
            sesi = SesiRepository.get_aktif_by_pc(pc.id)
            if pc.is_admin_mode and sesi and (sesi.nama_guest or "").strip().upper() == "SYSTEM":
                errors.append({"pc_id": pc_id, "pc_kode": pc.kode, "error": "Aksi operasional tidak diizinkan pada PC mode SYSTEM"})
                continue

            try:
                ClientService.queue_command(pc.id, action)
                write_log("REMOTE_ACTION_BATCH", f"Perintah {action_label} batch dikirim ke PC {pc.kode}", user=operator, detail_json={"pc_kode": pc.kode, "action": action})
                success_list.append(pc.kode)
            except Exception as e:
                errors.append({"pc_id": pc_id, "pc_kode": pc.kode, "error": str(e)})

        return jsonify({
            "success": len(success_list) > 0,
            "success_pcs": success_list,
            "errors": errors,
            "total_success": len(success_list),
            "total_failed": len(errors)
        }), 200
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
        from app.utils.timezone_utils import format_display, display_in_tz, get_tz_short_name
        from datetime import datetime, timezone

        pc = PCRepository.get_by_id(pc_id)
        if not pc:
            return jsonify({"success": False, "error": "PC tidak ditemukan"}), 404

        screenshot_path = os.path.join(current_app.root_path, 'static', 'uploads', 'screenshots', f"{pc.kode}.png")
        if os.path.exists(screenshot_path):
            mtime = os.path.getmtime(screenshot_path)
            dt_utc = datetime.fromtimestamp(mtime, tz=timezone.utc)
            local_dt = display_in_tz(dt_utc)
            now_local = display_in_tz(datetime.now(timezone.utc))
            tz_label = get_tz_short_name()
            full_time = format_display(dt_utc, fmt="%d/%m/%Y %H:%M:%S")
            if local_dt.date() == now_local.date():
                display_time = f"{local_dt.strftime('%H:%M:%S')} {tz_label}"
            else:
                display_time = f"{local_dt.strftime('%d/%m %H:%M')} {tz_label}"
            return jsonify({
                "success": True,
                "screenshot_url": f"/static/uploads/screenshots/{pc.kode}.png",
                "screenshot_time": full_time,
                "screenshot_time_display": display_time,
                "mtime": mtime
            }), 200
        else:
            return jsonify({
                "success": True,
                "screenshot_url": None,
                "screenshot_time": None,
                "screenshot_time_display": None,
                "mtime": 0
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
        from app.utils.timezone_utils import format_display, display_in_tz, get_tz_short_name
        from datetime import datetime, timezone

        pcs = PCRepository.get_all()
        # Urutkan daftar PC secara natural berdasarkan grup dan kode PC
        pcs_sorted = sorted(pcs, key=lambda pc: (pc.grup_id or 0, natural_sort_key(pc.kode)))
        result = []

        tz_label = get_tz_short_name()
        now_local = display_in_tz(datetime.now(timezone.utc))

        for pc in pcs_sorted:
            screenshot_path = os.path.join(current_app.root_path, 'static', 'uploads', 'screenshots', f"{pc.kode}.png")
            if os.path.exists(screenshot_path):
                mtime = os.path.getmtime(screenshot_path)
                dt_utc = datetime.fromtimestamp(mtime, tz=timezone.utc)
                local_dt = display_in_tz(dt_utc)
                full_time = format_display(dt_utc, fmt="%d/%m/%Y %H:%M:%S")
                if local_dt.date() == now_local.date():
                    display_time = f"{local_dt.strftime('%H:%M:%S')} {tz_label}"
                else:
                    display_time = f"{local_dt.strftime('%d/%m %H:%M')} {tz_label}"
                result.append({
                    "pc_id": pc.id,
                    "pc_kode": pc.kode,
                    "pc_grup_id": pc.grup_id or 0,
                    "pc_grup_nama": pc.grup.nama if pc.grup else "Unknown",
                    "screenshot_url": f"/static/uploads/screenshots/{pc.kode}.png",
                    "screenshot_time": full_time,
                    "screenshot_time_display": display_time,
                    "mtime": mtime
                })
            else:
                result.append({
                    "pc_id": pc.id,
                    "pc_kode": pc.kode,
                    "pc_grup_id": pc.grup_id or 0,
                    "pc_grup_nama": pc.grup.nama if pc.grup else "Unknown",
                    "screenshot_url": None,
                    "screenshot_time": None,
                    "screenshot_time_display": None,
                    "mtime": 0
                })
                
        return jsonify({"success": True, "data": result}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

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


@monitor_kasir_bp.route("/vnc_client/<int:pc_id>/start", methods=["POST"])
@login_required
@admin_required
@shift_required
def start_vnc_client(pc_id):
    from app.routes.vnc.vnc_routes import handle_start_vnc_client
    return handle_start_vnc_client(pc_id)


@monitor_kasir_bp.route("/vnc_client/<int:pc_id>/stop", methods=["POST"])
@login_required
@admin_required
@shift_required
def stop_vnc_client(pc_id):
    from app.routes.vnc.vnc_routes import handle_stop_vnc_client
    return handle_stop_vnc_client(pc_id)


@monitor_kasir_bp.route("/vnc_client/<int:pc_id>/status", methods=["GET"])
@login_required
@admin_required
def status_vnc_client(pc_id):
    from app.routes.vnc.vnc_routes import handle_status_vnc_client
    return handle_status_vnc_client(pc_id)
