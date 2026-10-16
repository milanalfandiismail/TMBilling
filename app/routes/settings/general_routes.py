"""Routes untuk manajemen pengaturan umum dan parameter operasional sistem.
Termasuk auto-shutdown, client polling, apikey, timezone, dan scheduler.
"""
from flask import request, jsonify, session, current_app
from app.services import SettingsService
from app.routes.auth.auth_kasir_routes import login_required, admin_required
from app.utils.logger import write_log
from app.utils.scheduler_tasks import UNIT_MULTIPLIER
from app.utils.validators import validate_string_length
from app.routes.settings.settings_routes import settings_api_bp

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
        
        from app.utils.validators import validate_integer_range
        timer_seconds = validate_integer_range(data.get("timer_seconds"), min_val=30, max_val=600, field_name="Timer Auto-Shutdown")
        
        # Simpan ke Database via Service
        old_val = SettingsService.get("auto_shutdown_timer_seconds", "180")
        SettingsService.set("auto_shutdown_timer_seconds", str(timer_seconds))
        operator = session.get("kasir_username", "admin")
        write_log(
            "SETTINGS_AUTO_SHUTDOWN",
            f"Timer auto-shutdown diubah dari {old_val}s menjadi {timer_seconds}s",
            user=operator,
            detail_json={"timer_sebelum": old_val, "timer_baru": timer_seconds}
        )
        return jsonify({"success": True, "message": "Timer berhasil diperbarui"}), 200
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@settings_api_bp.route("/client-polling-interval", methods=["PUT"])
@login_required
@admin_required
def update_client_polling_interval():
    """
    Update interval polling PC Client.
    Validasi: Hanya boleh nilai 1, 5, atau 10 detik.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body diperlukan"}), 400
        
        interval_raw = data.get("interval_seconds")
        if interval_raw is None:
            interval_raw = data.get("value")

        old_val = SettingsService.get_client_polling_interval()
        new_val = SettingsService.set_client_polling_interval(interval_raw)
        
        operator = session.get("kasir_username", "admin")
        write_log(
            "SETTINGS_CLIENT_POLLING_INTERVAL",
            f"Interval polling client diubah dari {old_val}s menjadi {new_val}s",
            user=operator,
            detail_json={"interval_sebelum": old_val, "interval_baru": new_val}
        )
        return jsonify({
            "success": True,
            "message": f"Interval polling client berhasil diset ke {new_val} detik",
            "interval_seconds": new_val
        }), 200
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@settings_api_bp.route("/<key>", methods=["GET", "PUT"])
@login_required
@admin_required
def handle_setting(key):
    """Ambil (GET) atau perbarui (PUT) pengaturan secara individual."""
    if request.method == "GET":
        try:
            default_map = {
                "warnet_title": "TMBilling",
                "warnet_address": "Jl. Merdeka No. 123, Kota",
                "warnet_phone": "0812-3456-7890",
                "warnet_footer": "Terima kasih, selamat bermain!",
            }
            default_val = default_map.get(key, None)
            val = SettingsService.get(key, default_val)
            if val is None:
                return jsonify({"success": False, "error": f"Setting '{key}' tidak ditemukan"}), 404
            return jsonify({
                "success": True,
                "key": key,
                "value": val,
                key: val,
                "data": {
                    "key": key,
                    "value": val,
                    key: val
                }
            }), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    # Method PUT
    try:
        data = request.get_json() or {}
        value = data.get("value")
        
        if value is None:
            return jsonify({"error": "Nilai 'value' wajib diisi"}), 400

        if key == "warnet_announcement":
            from app.utils.helpers import sanitize_html
            value = sanitize_html(str(value))
            
        old_val = SettingsService.get(key, "-")
        SettingsService.set(key, str(value))
        operator = session.get("kasir_username", "admin")
        action_name = "PAYMENT_METHOD_CONFIG" if key == "payment_methods" else "SETTINGS_UPDATE"
        write_log(
            action_name,
            f"Pengaturan '{key}' diperbarui",
            user=operator,
            detail_json={"key": key, "old_value": old_val, "new_value": str(value)}
        )
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
        
        try:
            value = validate_string_length(value, min_len=4, max_len=128, field_name="Client API Key", required=True)
        except ValueError as val_err:
            return jsonify({"error": str(val_err)}), 400
        
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
        screenshot_enabled = data.get("screenshot_enabled", "0")
        screenshot_value = data.get("screenshot_value")
        screenshot_unit = data.get("screenshot_unit")

        # Validasi
        if backup_value is None or backup_unit is None:
            return jsonify({"error": "backup_value dan backup_unit wajib diisi"}), 400
        if cleanup_value is None or cleanup_unit is None:
            return jsonify({"error": "cleanup_value dan cleanup_unit wajib diisi"}), 400
        if screenshot_value is None or screenshot_unit is None:
            return jsonify({"error": "screenshot_value dan screenshot_unit wajib diisi"}), 400

        try:
            backup_value = int(backup_value)
            cleanup_value = int(cleanup_value)
            screenshot_value = int(screenshot_value)
        except ValueError:
            return jsonify({"error": "Nilai interval harus berupa angka"}), 400

        if backup_value < 1 or cleanup_value < 1 or screenshot_value < 1:
            return jsonify({"error": "Nilai interval minimal 1"}), 400

        valid_units = set(UNIT_MULTIPLIER.keys())
        if backup_unit not in valid_units or cleanup_unit not in valid_units or screenshot_unit not in valid_units:
            return jsonify({"error": f"Unit tidak valid. Gunakan: {', '.join(valid_units)}"}), 400

        # Simpan ke DB
        SettingsService.set("auto_backup_value", str(backup_value))
        SettingsService.set("auto_backup_unit", backup_unit)
        SettingsService.set("auto_cleanup_value", str(cleanup_value))
        SettingsService.set("auto_cleanup_unit", cleanup_unit)
        SettingsService.set("screenshot_auto_enabled", str(screenshot_enabled))
        SettingsService.set("screenshot_auto_value", str(screenshot_value))
        SettingsService.set("screenshot_auto_unit", screenshot_unit)

        operator = session.get("kasir_username", "admin")
        write_log("SCHEDULER_CONFIG", f"Backup: {backup_value} {backup_unit}, Cleanup: {cleanup_value} {cleanup_unit}, Screenshot: {'On' if screenshot_enabled == '1' else 'Off'} ({screenshot_value} {screenshot_unit})", user=operator)

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


