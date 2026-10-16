"""Routes untuk backup, maintenance database, QRIS, dan token uninstall client.
"""
import os
from datetime import datetime
from flask import request, jsonify, session, current_app, send_file
from app.services import SettingsService, BackupService
from app.routes.auth.auth_kasir_routes import login_required, admin_required
from app.utils.logger import write_log
from app.routes.settings.settings_routes import settings_api_bp

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



@settings_api_bp.route("/database/purge-and-vacuum", methods=["POST"])
@login_required
@admin_required
def purge_and_vacuum_database():
    """Endpoint untuk pembersihan histori database tua dan optimasi VACUUM (Admin only)."""
    data = request.get_json(silent=True) or {}
    retention_months = data.get("retention_months", 6)

    try:
        retention_months = int(retention_months)
    except (ValueError, TypeError):
        return jsonify({"success": False, "error": "Batas bulan retensi tidak valid."}), 400

    try:
        from app.services.settings.db_maintenance_service import DBMaintenanceService
        result = DBMaintenanceService.purge_and_vacuum(retention_months)
        operator = session.get("kasir_username", "admin")
        write_log(
            aksi="DB_MAINTENANCE",
            detail=f"Admin membersihkan data histori > {retention_months} bulan & VACUUM DB. Space terhemat: {result['storage_stats']['saved_space_human']}",
            user=operator
        )
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


