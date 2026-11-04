# app/routes/monitor/screenshot_routes.py

"""Routes untuk screenshot capture, upload, dan monitoring status.

Blueprint ini menangani endpoint bagi kasir untuk memicu capture screenshot
dan client PC untuk mengunggah tangkapan layar.
"""

import os
import time
from datetime import datetime, timezone
from flask import request, jsonify, session, current_app
from app.middleware.auth import login_required, admin_required, shift_required
from app.routes.client.client_routes import api_key_required
from app.utils.logger import write_log
from app.utils.timezone_utils import format_display, display_in_tz, get_tz_short_name


_STAT_CACHE = {}
_STAT_TTL_SECONDS = 5


def _screenshot_mtime(path):
    """Mtime file screenshot dengan cache 5 detik (hindari 2 syscall per PC per detik)."""
    now_ts = time.time()
    cached = _STAT_CACHE.get(path)
    if cached and now_ts - cached[0] < _STAT_TTL_SECONDS:
        return cached[1]
    mtime = os.path.getmtime(path) if os.path.exists(path) else None
    _STAT_CACHE[path] = (now_ts, mtime)
    return mtime


def register_screenshot_routes(kasir_bp, client_bp, natural_sort_key):
    """Mendaftarkan route screenshot ke Blueprint kasir dan client."""

    @kasir_bp.route("/screenshot/trigger/<int:pc_id>", methods=["POST"])
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

    @client_bp.route("/screenshot/upload", methods=["POST"])
    @api_key_required
    def upload_screenshot():
        """Endpoint bagi client PC untuk mengunggah tangkapan layar (screenshot) terbaru."""
        try:
            from app.repositories import PCRepository

            client_ip = request.headers.get("X-IP-Address") or request.remote_addr
            pc = PCRepository.get_by_ip(client_ip)
            if not pc:
                return jsonify({"error": "IP PC tidak dikenal"}), 404

            image_data = request.data
            if not image_data:
                return jsonify({"error": "Data gambar kosong"}), 400

            upload_folder = os.path.join(current_app.root_path, 'static', 'uploads', 'screenshots')
            if not os.path.exists(upload_folder):
                os.makedirs(upload_folder, exist_ok=True)

            file_path = os.path.join(upload_folder, f"{pc.kode}.png")
            with open(file_path, "wb") as f:
                f.write(image_data)

            write_log("SCREENSHOT_UPLOAD", f"Screenshot PC {pc.kode} berhasil disimpan")
            return jsonify({"success": True, "message": "Screenshot berhasil diunggah"}), 200
        except Exception as e:
            write_log("SCREENSHOT_UPLOAD_ERROR", f"Gagal simpan screenshot: {str(e)}")
            return jsonify({"error": str(e)}), 500

    @kasir_bp.route("/screenshot/status/<int:pc_id>", methods=["GET"])
    @login_required
    def get_screenshot_status(pc_id):
        """Mengecek status dan timestamp screenshot terakhir untuk PC tertentu."""
        try:
            from app.repositories import PCRepository

            pc = PCRepository.get_by_id(pc_id)
            if not pc:
                return jsonify({"success": False, "error": "PC tidak ditemukan"}), 404

            screenshot_path = os.path.join(current_app.root_path, 'static', 'uploads', 'screenshots', f"{pc.kode}.png")
            if os.path.exists(screenshot_path):
                mtime = os.path.getmtime(screenshot_path)
                dt_utc = datetime.fromtimestamp(mtime, tz=timezone.utc)
                local_dt = display_in_tz(dt_utc)
                now_local_dt = display_in_tz(datetime.now(timezone.utc))
                tz_label = get_tz_short_name()
                full_time = format_display(dt_utc, fmt="%d/%m/%Y %H:%M:%S")
                if local_dt.date() == now_local_dt.date():
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

    @kasir_bp.route("/screenshot/all", methods=["GET"])
    @login_required
    def get_all_screenshot_status():
        """Mengecek status dan timestamp screenshot terakhir untuk semua PC."""
        try:
            from app.repositories import PCRepository

            pcs = PCRepository.get_all()
            pcs_sorted = sorted(pcs, key=lambda pc: (pc.grup_id or 0, natural_sort_key(pc.kode)))
            result = []

            tz_label = get_tz_short_name()
            now_local_dt = display_in_tz(datetime.now(timezone.utc))

            for pc in pcs_sorted:
                screenshot_path = os.path.join(current_app.root_path, 'static', 'uploads', 'screenshots', f"{pc.kode}.png")
                mtime = _screenshot_mtime(screenshot_path)
                if mtime is not None:
                    dt_utc = datetime.fromtimestamp(mtime, tz=timezone.utc)
                    local_dt = display_in_tz(dt_utc)
                    full_time = format_display(dt_utc, fmt="%d/%m/%Y %H:%M:%S")
                    if local_dt.date() == now_local_dt.date():
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
