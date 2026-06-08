# app/routes/settings_routes.py

"""Routes untuk manajemen pengaturan sistem.

Blueprint ini menyediakan endpoint untuk konfigurasi global aplikasi,
seperti timer auto-shutdown dan parameter sistem lainnya.
"""
import os
from flask import Blueprint, request, jsonify, session, current_app, send_file
from datetime import datetime
from app.services.backup_service import BackupService
from app.routes.auth_kasir_routes import login_required
from app.services.settings_service import SettingsService
from app.utils.logger import write_log

settings_bp = Blueprint("settings", __name__)


# =========================================================================
# 1. KONFIGURASI GLOBAL (READ)
# =========================================================================
# Fokus: Mengambil seluruh data pengaturan untuk ditampilkan di dashboard.

@settings_bp.route("/settings", methods=["GET"])
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

@settings_bp.route("/settings/auto-shutdown", methods=["PUT"])
@login_required
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

@settings_bp.route("/settings/<key>", methods=["PUT"])
@login_required
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

@settings_bp.route("/settings/apikey", methods=["PUT"])
@login_required
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
        env_path = os.path.join(current_app.root_path, '.env')
        if not os.path.exists(env_path):
            env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '.env'))
            
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

@settings_bp.route("/settings/backup/manual", methods=["POST"])
@login_required
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
    
@settings_bp.route("/settings/backup/download", methods=["GET"])
@login_required
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


# =========================================================================
# 4. CLIENT ACCESS ENDPOINT (MGCTM SECURE SINKRONISASI)
# =========================================================================

@settings_bp.route("/settings/uninstall-token/client", methods=["GET"])
def get_uninstall_token_for_client():
    """Endpoint aman bagi client (MGCTM) untuk mengambil token uninstall aktif saat ini."""
    from app.routes.client_routes import api_key_required
    
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
