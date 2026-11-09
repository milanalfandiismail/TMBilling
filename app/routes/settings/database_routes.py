"""Routes untuk backup, maintenance database, QRIS, dan token uninstall client.
"""
import io
import os
from datetime import datetime
from flask import request, jsonify, session, current_app, send_file
from app.services import SettingsService, BackupService
from app.services.backup.backup_service import default_backup_dir, default_db_path
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
        backup_dir = default_backup_dir()

        # 2. Eksekusi Backup (path DB diturunkan dari engine SQLAlchemy aktif)
        backup_manager = BackupService(backup_dir=backup_dir)
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
    """Snapshot WAL-safe database aktif (Online Backup API) lalu kirim ke browser."""
    import sqlite3
    import tempfile
    from flask import after_this_request

    db_path = default_db_path()
    fd, snapshot_path = tempfile.mkstemp(suffix='.db', dir=os.path.dirname(db_path))
    os.close(fd)
    try:
        src = sqlite3.connect(db_path)
        dst = sqlite3.connect(snapshot_path)
        try:
            src.backup(dst)
            check = dst.execute("PRAGMA integrity_check").fetchone()
        finally:
            dst.close()
            src.close()

        if not check or check[0] != "ok":
            raise RuntimeError("Snapshot database tidak lolos integrity_check")

        operator = session.get("kasir_username", "admin")
        write_log("DATABASE_DOWNLOAD", "User mendownload backup database ke lokal", user=operator)

        @after_this_request
        def _remove_snapshot(response):
            try:
                os.remove(snapshot_path)
            except OSError:
                pass
            return response

        return send_file(
            snapshot_path,
            as_attachment=True,
            download_name=f"warnet_manual_backup_{datetime.now().strftime('%Y%m%d')}.db",
            mimetype='application/x-sqlite3'
        )
    except Exception as e:
        if os.path.exists(snapshot_path):
            os.remove(snapshot_path)
        return jsonify({"error": str(e)}), 500


QRIS_MAX_SIDE = 800


def _qris_upload_dir():
    """Direktori gambar QRIS selalu mengikuti static folder aplikasi."""
    return os.path.join(current_app.static_folder, "uploads", "qris")


def _normalize_qris(file):
    """Kembalikan (ext, bytes) gambar QRIS yang sudah divalidasi & dikecilkan."""
    from PIL import Image
    try:
        img = Image.open(file.stream)
        img.load()
    except Exception:
        raise ValueError("File bukan gambar yang valid")

    fmt = (img.format or "").upper()
    if max(img.size) > QRIS_MAX_SIDE:
        img.thumbnail((QRIS_MAX_SIDE, QRIS_MAX_SIDE), Image.Resampling.LANCZOS)

    buf = io.BytesIO()
    if fmt == "JPEG":
        img.convert("RGB").save(buf, "JPEG", quality=90, optimize=True)
        return ".jpg", buf.getvalue()
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA" if "A" in img.getbands() else "RGB")
    img.save(buf, "PNG", optimize=True)
    return ".png", buf.getvalue()


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
        upload_folder = _qris_upload_dir()
        if not os.path.exists(upload_folder):
            os.makedirs(upload_folder, exist_ok=True)

        try:
            ext, data = _normalize_qris(file)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

        # Tambahkan timestamp unik di nama file untuk mencegah caching browser/client
        import time
        unique_filename = f"qris_{int(time.time())}{ext}"

        with open(os.path.join(upload_folder, unique_filename), "wb") as fh:
            fh.write(data)
        
        # Simpan path url ke settings database
        qris_url = f"/static/uploads/qris/{unique_filename}"
        old_url = SettingsService.get("qris_image_url", "")
        SettingsService.set("qris_image_url", qris_url)
        if old_url.startswith("/static/uploads/qris/") and old_url != qris_url:
            old_path = os.path.join(upload_folder, os.path.basename(old_url))
            if os.path.exists(old_path):
                os.remove(old_path)
        
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
            from app.repositories.pc.pc_repository import PCRepository
            from app.services.ip_whitelist.ip_whitelist_service import IpWhitelistService
            client_ip = IpWhitelistService.extract_client_ip(
                headers=request.headers, remote_addr=request.remote_addr
            )
            if not PCRepository.find_by_ip(client_ip):
                return jsonify({"error": "Perangkat tidak terdaftar"}), 403
            # Token darurat server tidak boleh bocor ke endpoint client; hanya token uninstall
            uninstall_token = SettingsService.get_or_create_uninstall_token()
            return jsonify({
                "success": True, 
                "uninstall_token": uninstall_token
            }), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
            
    return execute_request()


# =========================================================================



@settings_api_bp.route("/database/stats", methods=["GET"])
@login_required
@admin_required
def get_database_stats():
    """Endpoint untuk mengambil statistik ukuran database dan baris histori operasional."""
    try:
        from app.services.settings.db_maintenance_service import DBMaintenanceService
        stats = DBMaintenanceService.get_database_stats()
        return jsonify({"success": True, "stats": stats}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


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


