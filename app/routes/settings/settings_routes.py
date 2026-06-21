# app/routes/settings_routes.py

"""Routes untuk manajemen pengaturan sistem.

Blueprint ini menyediakan endpoint untuk konfigurasi global aplikasi,
seperti timer auto-shutdown dan parameter sistem lainnya.
"""
import os
import subprocess
import sys
from flask import Blueprint, request, jsonify, session, current_app, send_file, redirect, render_template
from datetime import datetime
from functools import wraps
from app.services import BackupService
from app.routes.auth.auth_kasir_routes import login_required, admin_required
from app.services import SettingsService
from app.utils.logger import write_log
from app.services.ip_whitelist.ip_whitelist_service import IpWhitelistService
from app.utils.helpers import UNIT_MULTIPLIER

settings_api_bp = Blueprint("settings", __name__)


# =========================================================================
# 1. KONFIGURASI GLOBAL (READ)
# =========================================================================
# Fokus: Mengambil seluruh data pengaturan untuk ditampilkan di dashboard.

@settings_api_bp.route("/", methods=["GET"])
@login_required
def get_all_settings():
    """Ambil semua daftar pengaturan sistem dalam format Key-Value."""
    try:
        data = SettingsService.get_all()
        data["client_api_key"] = current_app.config.get("CLIENT_API_KEY", "TM2026QWERTY-api-key")
        return jsonify({"success": True, "settings": data}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =========================================================================
# 2. PEMBARUAN PENGATURAN (WRITE)
# =========================================================================
# Fokus: Mengubah nilai konfigurasi dengan validasi spesifik maupun generik.

@settings_api_bp.route("/auto-shutdown", methods=["PUT"])
@login_required
@admin_required
def update_auto_shutdown():
    """
    Update khusus untuk timer auto-shutdown PC Client.
    Validasi: Harus angka antara 30 detik s/d 600 detik (10 menit).
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body diperlukan"}), 400
        
        timer_seconds = data.get("timer_seconds")
        if timer_seconds is None:
            return jsonify({"error": "timer_seconds wajib diisi"}), 400
        
        # Validasi Tipe Data & Range
        try:
            timer_seconds = int(timer_seconds)
        except ValueError:
            return jsonify({"error": "timer_seconds harus berupa angka"}), 400
        
        if timer_seconds < 30 or timer_seconds > 600:
            return jsonify({"error": "Range timer harus antara 30 s/d 600 detik"}), 400
        
        # Simpan ke Database via Service
        SettingsService.set("auto_shutdown_timer_seconds", str(timer_seconds))
        return jsonify({"success": True, "message": "Timer berhasil diperbarui"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@settings_api_bp.route("/<key>", methods=["PUT"])
@login_required
@admin_required
def update_setting(key):
    """Update pengaturan secara individual (Generic Endpoint)."""
    try:
        data = request.get_json() or {}
        value = data.get("value")
        
        if value is None:
            return jsonify({"error": "Nilai 'value' wajib diisi"}), 400
            
        SettingsService.set(key, str(value))
        return jsonify({"success": True, "message": f"Setting '{key}' diperbarui"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@settings_api_bp.route("/apikey", methods=["PUT"])
@login_required
@admin_required
def update_client_api_key():
    """Update global CLIENT_API_KEY in server .env file and active config."""
    try:
        data = request.get_json() or {}
        value = data.get("value")
        
        if not value or not value.strip():
            return jsonify({"error": "API Key tidak boleh kosong"}), 400
            
        value = value.strip()
        
        # 1. Update active Flask config so it takes effect instantly without server restart
        current_app.config["CLIENT_API_KEY"] = value
        
        # 2. Update .env file programmatically to persist across restarts
        # current_app.root_path = folder app/, satu level naik ke root project
        env_path = os.path.abspath(os.path.join(current_app.root_path, '..', '.env'))
            
        lines = []
        updated = False
        if os.path.exists(env_path):
            with open(env_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
                
            for i, line in enumerate(lines):
                if line.strip().startswith("CLIENT_API_KEY="):
                    lines[i] = f"CLIENT_API_KEY={value}\n"
                    updated = True
                    break
                    
        if not updated:
            lines.append(f"\nCLIENT_API_KEY={value}\n")
            
        with open(env_path, 'w', encoding='utf-8') as f:
            f.writelines(lines)
            
        # Log manual action
        operator = session.get("kasir_username", "admin")
        write_log("SETTINGS_APIKEY_CHANGE", f"User memperbarui CLIENT_API_KEY secara dinamis", user=operator)
        
        return jsonify({"success": True, "message": "API Key berhasil diperbarui di .env"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    

# =========================================================================
# 3. DATABASE BACKUP (MANUAL TRIGGER)
# =========================================================================

@settings_api_bp.route("/timezone", methods=["PUT"])
@login_required
@admin_required
def update_timezone():
    """Update timezone setting."""
    try:
        data = request.get_json() or {}
        tz_name = data.get("value", "").strip()

        if not tz_name:
            return jsonify({"error": "Timezone wajib diisi"}), 400

        # Validasi timezone
        from zoneinfo import ZoneInfo
        try:
            ZoneInfo(tz_name)
        except (KeyError, TypeError):
            return jsonify({"error": f"Timezone '{tz_name}' tidak valid"}), 400

        SettingsService.set("timezone", tz_name)

        operator = session.get("kasir_username", "admin")
        write_log("SETTINGS_TIMEZONE", f"Timezone diubah ke {tz_name}", user=operator)

        return jsonify({"success": True, "message": f"Timezone diubah ke {tz_name}"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@settings_api_bp.route("/backup/manual", methods=["POST"])
@login_required
@admin_required
def trigger_manual_backup():
    """Trigger backup database secara manual dari UI."""
    try:
        # 1. Tentukan path (disesuaikan dengan folder instance Flask)
        db_path = os.path.join(current_app.instance_path, 'warnet.db')
        backup_dir = os.path.abspath(os.path.join(current_app.instance_path, '..', 'backups'))
        
        # 2. Eksekusi Backup (Gunakan logic dari class yang sudah kita buat)
        backup_manager = BackupService(db_path=db_path, backup_dir=backup_dir)
        backup_manager.create_backup()
        backup_manager.cleanup_old_backups(max_keep=5)
        
        # 3. Log manual action
        operator = session.get("kasir_username", "admin")
        write_log("MANUAL_BACKUP", "User memicu backup database ke server", user=operator)
        
        return jsonify({
            "success": True, 
            "message": "Backup berhasil dibuat! Cek folder backups di server."
        }), 200
    except Exception as e:
        return jsonify({"error": f"Gagal melakukan backup: {str(e)}"}), 500
    
@settings_api_bp.route("/backup/download", methods=["GET"])
@login_required
@admin_required
def download_db():
    """Mengirim file warnet.db ke browser untuk di-download."""
    try:
        db_path = os.path.join(current_app.instance_path, 'warnet.db')
        
        operator = session.get("kasir_username", "admin")
        write_log("DATABASE_DOWNLOAD", "User mendownload backup database ke lokal", user=operator)
        
        return send_file(
            db_path,
            as_attachment=True,
            download_name=f"warnet_manual_backup_{datetime.now().strftime('%Y%m%d')}.db",
            mimetype='application/x-sqlite3'
        )
    except Exception as e:
        return str(e), 500


@settings_api_bp.route("/qris", methods=["POST"])
@login_required
@admin_required
def upload_qris():
    """Upload new QRIS image and update the setting path."""
    try:
        file = request.files.get("qris_image")
        if not file or file.filename == '':
            return jsonify({"error": "File QRIS wajib diunggah"}), 400
            
        # Validasi ekstensi
        # Karena allowed_file didefinisikan di menu_routes, kita bisa mendefinisikannya kembali secara lokal agar modular
        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
        filename = file.filename
        if not ('.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions):
            return jsonify({"error": "Ekstensi file tidak diizinkan (Gunakan: png, jpg, jpeg, gif, webp)"}), 400
            
        # Buat direktori upload jika belum ada
        upload_folder = os.path.join(current_app.root_path, 'static', 'uploads', 'qris')
        if not os.path.exists(upload_folder):
            os.makedirs(upload_folder, exist_ok=True)
            
        from werkzeug.utils import secure_filename
        filename = secure_filename(file.filename)
        base, ext = os.path.splitext(filename)
        
        # Tambahkan timestamp unik di nama file untuk mencegah caching browser/client
        import time
        unique_filename = f"qris_{int(time.time())}{ext}"
        
        file_path = os.path.join(upload_folder, unique_filename)
        file.save(file_path)
        
        # Simpan path url ke settings database
        qris_url = f"/static/uploads/qris/{unique_filename}"
        SettingsService.set("qris_image_url", qris_url)
        
        # Log manual action
        operator = session.get("kasir_username", "admin")
        write_log("SETTINGS_QRIS_CHANGE", f"User memperbarui gambar QRIS Kiosk", user=operator)
        
        return jsonify({"success": True, "qris_url": qris_url, "message": "QRIS berhasil diperbarui"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =========================================================================
# 5. AUTO SCHEDULER
# =========================================================================

@settings_api_bp.route("/scheduler", methods=["PUT"])
@login_required
@admin_required
def update_scheduler_config():
    """Simpan konfigurasi Auto Scheduler (backup + cleanup log)."""
    try:
        data = request.get_json() or {}
        backup_value = data.get("backup_value")
        backup_unit = data.get("backup_unit")
        cleanup_value = data.get("cleanup_value")
        cleanup_unit = data.get("cleanup_unit")

        # Validasi
        if backup_value is None or backup_unit is None:
            return jsonify({"error": "backup_value dan backup_unit wajib diisi"}), 400
        if cleanup_value is None or cleanup_unit is None:
            return jsonify({"error": "cleanup_value dan cleanup_unit wajib diisi"}), 400

        try:
            backup_value = int(backup_value)
            cleanup_value = int(cleanup_value)
        except ValueError:
            return jsonify({"error": "Nilai interval harus berupa angka"}), 400

        if backup_value < 1 or cleanup_value < 1:
            return jsonify({"error": "Nilai interval minimal 1"}), 400

        valid_units = set(UNIT_MULTIPLIER.keys())
        if backup_unit not in valid_units or cleanup_unit not in valid_units:
            return jsonify({"error": f"Unit tidak valid. Gunakan: {', '.join(valid_units)}"}), 400

        # Simpan ke DB
        SettingsService.set("auto_backup_value", str(backup_value))
        SettingsService.set("auto_backup_unit", backup_unit)
        SettingsService.set("auto_cleanup_value", str(cleanup_value))
        SettingsService.set("auto_cleanup_unit", cleanup_unit)

        operator = session.get("kasir_username", "admin")
        write_log("SCHEDULER_CONFIG", f"Backup: {backup_value} {backup_unit}, Cleanup: {cleanup_value} {cleanup_unit}", user=operator)

        return jsonify({"success": True, "message": "Konfigurasi scheduler disimpan"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@settings_api_bp.route("/scheduler/restart", methods=["POST"])
@login_required
@admin_required
def restart_scheduler():
    """Restart aplikasi agar scheduler menggunakan interval baru."""
    try:
        operator = session.get("kasir_username", "admin")
        write_log("SCHEDULER_RESTART", "Restart aplikasi untuk menerapkan interval baru", user=operator)

        # Kirim response dulu sebelum matiin server
        resp = jsonify({"success": True, "message": "Server akan restart dalam 1 detik..."})

        # Schedule restart setelah response terkirim
        import threading
        def _do_restart():
            import time
            time.sleep(1.5)
            # Hapus env var werkzeug (WERKZEUG_SERVER_FD) agar tidak diwariskan
            # ke process baru, karena FD tersebut sudah invalid setelah parent exit
            env = os.environ.copy()
            env.pop('WERKZEUG_SERVER_FD', None)
            env.pop('WERKZEUG_RUN_MAIN', None)
            subprocess.Popen([sys.executable] + sys.argv, env=env)
            os._exit(0)

        threading.Thread(target=_do_restart, daemon=True).start()
        return resp
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =========================================================================
# 4. CLIENT ACCESS ENDPOINT (MGCTM SECURE SINKRONISASI)
# =========================================================================

@settings_api_bp.route("/uninstall-token/client", methods=["GET"])
def get_uninstall_token_for_client():
    """Endpoint aman bagi client (MGCTM) untuk mengambil token uninstall aktif saat ini."""
    from app.routes.client.client_routes import api_key_required
    
    @api_key_required
    def execute_request():
        try:
            uninstall_token = SettingsService.get("uninstall_token", "TM_UNINSTALL_SAFE_2026")
            # Ambil emergency token dinamis dari database, fallback ke .env, fallback ke default "TM123qaz!@#"
            emergency_token = SettingsService.get("emergency_token") or current_app.config.get("EMERGENCY_UNINSTALL_TOKEN", "TM123qaz!@#")
            return jsonify({
                "success": True, 
                "uninstall_token": uninstall_token,
                "emergency_token": emergency_token
            }), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
            
    return execute_request()


# =========================================================================
# 9. IP WHITELIST (CRUD + TOGGLE + TOKEN + STATUS + PAGE)
# =========================================================================


def ip_whitelist_admin_required(f):
    """Decorator: butuh admin login + IP whitelist access."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('kasir_id') or session.get('kasir_role') != 'admin':
            return jsonify({'error': 'unauthorized'}), 401

        ip = IpWhitelistService.get_client_ip()
        is_ip_ok = IpWhitelistService.is_ip_whitelisted(ip)
        is_session_ok = IpWhitelistService.is_session_authenticated()

        if not (is_ip_ok or is_session_ok):
            write_log(
                aksi='IP_WHITELIST_BLOCK',
                detail=f"Admin diblokir mengedit whitelist dari IP {ip}",
                user=session.get('kasir_username', session.get('kasir_nama', 'admin'))
            )
            return jsonify({'error': 'forbidden', 'ip': ip}), 403

        return f(*args, **kwargs)
    return decorated


@settings_api_bp.route("/ip-whitelist", methods=["GET"])
@login_required
@admin_required
def list_ip_whitelist():
    """GET — List semua IP whitelist entries."""
    try:
        entries = IpWhitelistService.get_entries()
        return jsonify({'entries': entries})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@settings_api_bp.route("/ip-whitelist", methods=["POST"])
@login_required
@admin_required
def add_whitelist_ip():
    """POST — Tambah IP baru ke whitelist."""
    try:
        data = request.get_json(silent=True) or {}
        ip = data.get('ip', '').strip()
        label = data.get('label', '').strip()

        if not ip:
            return jsonify({'error': 'IP address diperlukan.'}), 400

        entries = IpWhitelistService.add(ip, label)
        return jsonify({'success': True, 'entries': entries})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@settings_api_bp.route("/ip-whitelist/<ip>", methods=["DELETE"])
@login_required
@admin_required
@ip_whitelist_admin_required
def remove_whitelist_ip(ip):
    """DELETE — Hapus IP dari whitelist."""
    try:
        entries = IpWhitelistService.remove(ip)
        return jsonify({'success': True, 'entries': entries})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@settings_api_bp.route("/ip-whitelist/toggle", methods=["POST"])
@login_required
@admin_required
@ip_whitelist_admin_required
def toggle_whitelist():
    """POST — Enable/disable IP whitelist."""
    try:
        data = request.get_json(silent=True) or {}
        enabled = data.get('enabled', False)
        IpWhitelistService.set_enabled(enabled)

        write_log(
            aksi='IP_WHITELIST_TOGGLE',
            detail=f"Whitelist {'diaktifkan' if enabled else 'dinonaktifkan'}",
            user=session.get('username', 'admin')
        )
        return jsonify({'success': True, 'enabled': enabled})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@settings_api_bp.route("/ip-whitelist/regenerate-token", methods=["POST"])
@login_required
@admin_required
@ip_whitelist_admin_required
def regenerate_whitelist_token():
    """POST — Generate bypass token baru (invalidate semua sesi)."""
    try:
        token, version = IpWhitelistService.regenerate_token()
        return jsonify({'success': True, 'token': token, 'version': version})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@settings_api_bp.route("/ip-whitelist/status", methods=["GET"])
@login_required
@admin_required
def status_whitelist():
    """GET — Status ringkas whitelist (enabled, current_ip, token_masked, full_url)."""
    try:
        enabled = IpWhitelistService.is_enabled()
        entries = IpWhitelistService.get_entries()
        token = IpWhitelistService.get_token()
        token_masked = IpWhitelistService.get_token_masked()
        current_ip = IpWhitelistService.get_client_ip()
        public_url = IpWhitelistService.get_public_url()

        if public_url:
            base = public_url.rstrip('/')
        else:
            base = request.host_url.rstrip('/')

        full_url = f"{base}/kasir?token={token}"

        return jsonify({
            'enabled': enabled,
            'current_ip': current_ip,
            'count': len(entries),
            'token_masked': token_masked,
            'full_url': full_url,
            'public_url': public_url
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@settings_api_bp.route("/app-public-url", methods=["POST"])
@login_required
@admin_required
@ip_whitelist_admin_required
def set_app_public_url():
    """POST — Simpan domain publik tunnel."""
    try:
        data = request.get_json(silent=True) or {}
        url = data.get('url', '').strip()
        IpWhitelistService.set_public_url(url)

        write_log(
            aksi='IP_WHITELIST_PUBLIC_URL',
            detail=f"Domain publik diubah: {url or '(dikosongkan)'}",
            user=session.get('username', 'admin')
        )
        return jsonify({'success': True, 'url': url})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


    return execute_request()
