# app/routes/backup_routes.py

import os
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app, send_file
from app.routes.auth.auth_kasir_routes import login_required, admin_required
from app.services import BackupService
from app.utils.logger import write_log

backup_api_bp = Blueprint("backup", __name__)

@backup_api_bp.route("/trigger", methods=["POST"])
@login_required
@admin_required
def trigger_backup():
    """Trigger manual database backup and upload to active cloud providers."""
    try:
        db_path = os.path.join(current_app.instance_path, 'warnet.db')
        backup_dir = os.path.abspath(os.path.join(current_app.instance_path, '..', 'backups'))
        
        backup_manager = BackupService(db_path=db_path, backup_dir=backup_dir)
        zip_path = backup_manager.create_backup()
        backup_manager.cleanup_old_backups(max_keep=5)
        
        filename = os.path.basename(zip_path)
        write_log("MANUAL_BACKUP", f"User memicu backup cloud: {filename}", user="admin")
        
        return jsonify({
            "success": True,
            "message": "Backup manual dan upload cloud berhasil diproses!",
            "filename": filename
        }), 200
    except Exception as e:
        write_log("BACKUP_ERROR", f"Gagal manual backup: {str(e)}", user="admin")
        return jsonify({"success": False, "error": str(e)}), 500


@backup_api_bp.route("/test-connection", methods=["POST"])
@login_required
@admin_required
def test_connection():
    """Test connection for a specific provider with temporary parameters."""
    try:
        data = request.get_json() or {}
        provider_type = data.get("provider")
        
        if not provider_type:
            return jsonify({"success": False, "error": "Provider type is required"}), 400
            
        from app.services.backup.providers import (
            DiscordWebhookProvider, WebDAVProvider, GoogleDriveProvider, NASBackupProvider
        )
        
        provider = None
        if provider_type == "discord":
            url = data.get("url")
            if not url:
                return jsonify({"success": False, "error": "Webhook URL is required"}), 400
            provider = DiscordWebhookProvider(url)
            
        elif provider_type == "webdav":
            url = data.get("url")
            username = data.get("username")
            password = data.get("password")
            if not url:
                return jsonify({"success": False, "error": "WebDAV URL is required"}), 400
            provider = WebDAVProvider(url, username, password)
            
        elif provider_type == "gdrive":
            client_id = data.get("client_id")
            client_secret = data.get("client_secret")
            refresh_token = data.get("refresh_token")
            folder_id = data.get("folder_id")
            if not client_id or not client_secret or not refresh_token:
                return jsonify({"success": False, "error": "Client ID, Secret, and Refresh Token are required"}), 400
            provider = GoogleDriveProvider(client_id, client_secret, refresh_token, folder_id)
            
        elif provider_type == "nas":
            path = data.get("path")
            if not path:
                return jsonify({"success": False, "error": "NAS path is required"}), 400
            provider = NASBackupProvider(path)
            
        else:
            return jsonify({"success": False, "error": f"Unknown provider: {provider_type}"}), 400
            
        success = provider.test_connection()
        if success:
            return jsonify({"success": True, "message": f"Koneksi ke {provider.name} Berhasil!"}), 200
        else:
            return jsonify({"success": False, "error": f"Koneksi ke {provider.name} Gagal! Silakan cek kredensial Anda."}), 400
            
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@backup_api_bp.route("/list", methods=["GET"])
@login_required
@admin_required
def list_backups():
    """List all local ZIP backup files."""
    try:
        backup_dir = os.path.abspath(os.path.join(current_app.instance_path, '..', 'backups'))
        if not os.path.exists(backup_dir):
            return jsonify({"success": True, "backups": []}), 200
            
        files = []
        for f in os.listdir(backup_dir):
            if f.startswith("warnet_backup_") and f.endswith(".zip"):
                path = os.path.join(backup_dir, f)
                stat = os.stat(path)
                files.append({
                    "filename": f,
                    "size_mb": round(stat.st_size / (1024 * 1024), 2),
                    "created_at": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S")
                })
                
        # Sort newest first
        files.sort(key=lambda x: x["created_at"], reverse=True)
        return jsonify({"success": True, "backups": files}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@backup_api_bp.route("/download/<filename>", methods=["GET"])
@login_required
@admin_required
def download_backup(filename):
    """Download a specific backup ZIP file."""
    try:
        backup_dir = os.path.abspath(os.path.join(current_app.instance_path, '..', 'backups'))
        file_path = os.path.join(backup_dir, filename)
        
        # Security check to prevent Directory Traversal
        if not os.path.abspath(file_path).startswith(backup_dir):
            return jsonify({"success": False, "error": "Akses ditolak"}), 403
            
        if not os.path.exists(file_path) or not filename.endswith(".zip"):
            return jsonify({"success": False, "error": "File tidak ditemukan"}), 404
            
        write_log("DATABASE_DOWNLOAD", f"User mendownload backup: {filename}", user="admin")
        
        return send_file(
            file_path,
            as_attachment=True,
            download_name=filename,
            mimetype='application/zip'
        )
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@backup_api_bp.route("/delete/<filename>", methods=["DELETE"])
@login_required
@admin_required
def delete_backup(filename):
    """Delete a specific backup file from local storage."""
    try:
        backup_dir = os.path.abspath(os.path.join(current_app.instance_path, '..', 'backups'))
        file_path = os.path.join(backup_dir, filename)
        
        # Security check to prevent Directory Traversal
        if not os.path.abspath(file_path).startswith(backup_dir):
            return jsonify({"success": False, "error": "Akses ditolak"}), 403
            
        if not os.path.exists(file_path) or not filename.endswith(".zip"):
            return jsonify({"success": False, "error": "File tidak ditemukan"}), 404
            
        os.remove(file_path)
        write_log("BACKUP_DELETE", f"User menghapus backup lokal: {filename}", user="admin")
        
        return jsonify({"success": True, "message": "File backup berhasil dihapus!"}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
