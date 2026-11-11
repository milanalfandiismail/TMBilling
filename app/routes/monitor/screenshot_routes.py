# app/routes/monitor/screenshot_routes.py

"""Routes untuk screenshot capture, upload, dan monitoring status.

Blueprint ini menangani endpoint bagi kasir untuk memicu capture screenshot
dan client PC untuk mengunggah tangkapan layar.
"""

import io
import os
import time
from datetime import datetime, timezone
from flask import request, jsonify, session, current_app, send_from_directory
from PIL import Image
from app.middleware.auth import login_required, admin_required, shift_required
from app.routes.client.client_routes import api_key_required
from app.services.ip_whitelist.ip_whitelist_service import IpWhitelistService
from app.utils.logger import write_log
from app.utils.timezone_utils import format_display, display_in_tz, get_tz_short_name
from werkzeug.utils import secure_filename


def _upload_folder():
    """Folder screenshot privat (instance), tidak disajikan sebagai static publik."""
    return os.path.join(current_app.instance_path, "uploads", "screenshots")


def migrate_legacy_screenshots(app):
    """Pindahkan screenshot lama dari static publik ke folder instance privat."""
    legacy = os.path.join(app.static_folder, "uploads", "screenshots")
    target = os.path.join(app.instance_path, "uploads", "screenshots")
    if not os.path.isdir(legacy):
        return
    os.makedirs(target, exist_ok=True)
    for name in os.listdir(legacy):
        if not name.lower().endswith(".png"):
            continue
        src = os.path.join(legacy, name)
        dst = os.path.join(target, name)
        if not os.path.isfile(src):
            continue
        if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
            os.remove(src)
        else:
            os.replace(src, dst)


def _screenshot_filename(kode):
    """Nama file screenshot yang aman dipakai sebagai path."""
    flat = str(kode).replace("/", "").replace("\\", "")
    return f"{secure_filename(flat) or 'pc'}.png"


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

            client_ip = IpWhitelistService.extract_client_ip(
                headers=request.headers, remote_addr=request.remote_addr
            )
            pc = PCRepository.get_by_ip(client_ip)
            if not pc:
                return jsonify({"error": "IP PC tidak dikenal"}), 404

            image_data = request.data
            if not image_data:
                return jsonify({"error": "Data gambar kosong"}), 400

            try:
                with Image.open(io.BytesIO(image_data)) as img:
                    img.verify()
                with Image.open(io.BytesIO(image_data)) as img:
                    img.thumbnail((1280, 1280))
                    upload_folder = _upload_folder()
                    os.makedirs(upload_folder, exist_ok=True)
                    file_path = os.path.join(upload_folder, _screenshot_filename(pc.kode))
                    img.convert("RGB").save(file_path, format="PNG")
            except Exception:
                return jsonify({"error": "Data gambar tidak valid"}), 400

            write_log("SCREENSHOT_UPLOAD", f"Screenshot PC {pc.kode} berhasil disimpan")
            return jsonify({"success": True, "message": "Screenshot berhasil diunggah"}), 200
        except Exception as e:
            write_log("SCREENSHOT_UPLOAD_ERROR", f"Gagal simpan screenshot: {str(e)}")
            return jsonify({"error": str(e)}), 500

    @kasir_bp.route("/screenshot/status/<int:pc_id>", methods=["GET"])
    @login_required
    @admin_required
    def get_screenshot_status(pc_id):
        """Mengecek status dan timestamp screenshot terakhir untuk PC tertentu."""
        try:
            from app.repositories import PCRepository

            pc = PCRepository.get_by_id(pc_id)
            if not pc:
                return jsonify({"success": False, "error": "PC tidak ditemukan"}), 404

            screenshot_path = os.path.join(_upload_folder(), _screenshot_filename(pc.kode))
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
                    "screenshot_url": f"/api/v1/kasir/monitor/screenshot/image/{pc.id}",
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

    @kasir_bp.route("/screenshot/image/<int:pc_id>", methods=["GET"])
    @login_required
    @admin_required
    def get_screenshot_image(pc_id):
        """Sajikan byte screenshot hanya untuk admin yang login."""
        from app.repositories import PCRepository

        pc = PCRepository.get_by_id(pc_id)
        if not pc:
            return jsonify({"success": False, "error": "PC tidak ditemukan"}), 404
        filename = _screenshot_filename(pc.kode)
        if not os.path.exists(os.path.join(_upload_folder(), filename)):
            return jsonify({"success": False, "error": "Screenshot tidak tersedia"}), 404
        return send_from_directory(_upload_folder(), filename, mimetype="image/png")

    @kasir_bp.route("/screenshot/all", methods=["GET"])
    @login_required
    @admin_required
    def get_all_screenshot_status():
        """Mengecek status dan timestamp screenshot terakhir untuk semua PC."""
        try:
            from app.repositories import PCRepository

            pcs = PCRepository.get_all_light()
            pcs_sorted = sorted(pcs, key=lambda pc: (pc.grup_id or 0, natural_sort_key(pc.kode)))
            result = []

            tz_label = get_tz_short_name()
            now_local_dt = display_in_tz(datetime.now(timezone.utc))

            for pc in pcs_sorted:
                screenshot_path = os.path.join(_upload_folder(), _screenshot_filename(pc.kode))
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
                        "screenshot_url": f"/api/v1/kasir/monitor/screenshot/image/{pc.id}",
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
