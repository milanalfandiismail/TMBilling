import threading
from flask import Blueprint, request, jsonify
from app.routes.auth.auth_kasir_routes import login_required, admin_required
from app.models.mikrotik.mikrotik import MikroTikConfig
from app.utils.mikrotik_api import MikroTikAPIClient
from app.utils.logger import write_log
from app.models.base.base import db

mikrotik_api_bp = Blueprint("mikrotik", __name__)

@mikrotik_api_bp.route("/config", methods=["GET"])
@login_required
@admin_required
def get_mikrotik_config():
    """Mengambil konfigurasi MikroTik saat ini."""
    try:
        config = MikroTikConfig.get_instance()
        return jsonify({
            "success": True,
            "data": {
                "enabled": config.enabled,
                "host": config.host,
                "port": config.port,
                "username": config.username,
                "password": config.password,
                "hotspot_profile": config.hotspot_profile
            }
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@mikrotik_api_bp.route("/config", methods=["POST"])
@login_required
@admin_required
def save_mikrotik_config():
    """Menyimpan konfigurasi MikroTik."""
    try:
        from app.utils.validators import validate_integer_range, validate_string_length
        data = request.get_json() or {}
        config = MikroTikConfig.get_instance()
        host = data.get("host") or ""
        username = data.get("username") or ""
        
        # Update config fields
        config.enabled = bool(data.get("enabled", False))
        config.host = validate_string_length(host, min_len=1, max_len=255, field_name="Host MikroTik", required=config.enabled) if config.enabled else host.strip()
        config.port = validate_integer_range(data.get("port", 8728), min_val=1, max_val=65535, field_name="Port MikroTik")
        config.username = validate_string_length(username, min_len=1, max_len=64, field_name="Username MikroTik", required=config.enabled) if config.enabled else username.strip()
        
        # Jangan replace password jika kosong (agar tidak hilang)
        new_pass = data.get("password")
        if new_pass is not None and str(new_pass).strip() != "":
            config.password = str(new_pass).strip()
            
        config.hotspot_profile = validate_string_length(data.get("hotspot_profile", "default"), min_len=1, max_len=64, field_name="Profile Hotspot", required=False) or "default"
        
        db.session.commit()
        
        write_log("MIKROTIK_CONFIG", f"Konfigurasi MikroTik diperbarui (Enabled: {config.enabled})")
        return jsonify({"success": True, "message": "Pengaturan MikroTik berhasil disimpan"}), 200
        
    except ValueError as ve:
        db.session.rollback()
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@mikrotik_api_bp.route("/test", methods=["POST"])
@login_required
@admin_required
def test_mikrotik_connection():
    """Test koneksi ke MikroTik API berdasarkan parameter yang dikirim."""
    try:
        data = request.get_json() or {}
        host = data.get("host")
        port = data.get("port", 8728)
        username = data.get("username")
        password = data.get("password", "")

        if not host or not username:
            return jsonify({"error": "Host dan Username wajib diisi"}), 400

        client = MikroTikAPIClient(host, username, password, port)
        success, message = client.test_connection()

        if success:
            return jsonify({"success": True, "message": message}), 200
        else:
            return jsonify({"error": message}), 400

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@mikrotik_api_bp.route("/sync_all", methods=["POST"])
@login_required
@admin_required
def sync_all_mikrotik_members():
    """Sinkronisasi semua member dari database TMBilling ke MikroTik (Background)."""
    from app.services.member.member_service import MemberService

    config = MikroTikConfig.get_instance()
    if not config.enabled:
        return jsonify({"error": "Integrasi MikroTik belum diaktifkan."}), 400

    host = config.host
    port = config.port
    username = config.username
    mikrotik_password = config.password
    profile = config.hotspot_profile

    # Satu job massal per proses: klaim ditolak bila masih berjalan.
    if not _sync_lock.acquire(blocking=False):
        return jsonify({"error": "Sinkronisasi massal sedang berjalan."}), 409

    try:
        client = MikroTikAPIClient(host, username, mikrotik_password, port)
        success, msg = client.test_connection()
        if not success:
            _sync_lock.release()
            return jsonify({"error": f"Koneksi gagal: {msg}"}), 400

        # Ambil semua member (hanya username untuk meminimalisir memory)
        member_data = [{"username": m.username} for m in MemberService.get_all()]

        threading.Thread(
            target=_sync_members_background,
            args=(member_data, host, port, username, mikrotik_password, profile),
            daemon=True,
        ).start()
    except Exception as e:
        _sync_lock.release()
        return jsonify({"error": str(e)}), 500

    return jsonify({"success": True, "message": f"Sinkronisasi massal {len(member_data)} member sedang berjalan di latar belakang."}), 200


_sync_lock = threading.Lock()


def _sync_members_background(member_list, host, port, username, password, profile):
    """Menambahkan member ke hotspot MikroTik dan mencatat hasil sebenarnya."""
    cli = None
    sukses = 0
    gagal = 0
    try:
        cli = MikroTikAPIClient(host, username, password, port)
        if not cli.login():
            write_log("MIKROTIK_ERROR", "Gagal login saat sinkronisasi massal.")
            return
        for mem in member_list:
            try:
                if cli.add_user(mem["username"], mem["username"], profile):
                    sukses += 1
                else:
                    gagal += 1
            except Exception as e:
                gagal += 1
                write_log("MIKROTIK_SYNC_FAIL", f"Gagal menambah member {mem['username']}: {type(e).__name__}", user="SYSTEM")
        write_log("MIKROTIK_SYNC", f"Sinkronisasi massal selesai. {sukses} berhasil, {gagal} gagal dari {len(member_list)} member.")
    except Exception as e:
        write_log("MIKROTIK_ERROR", f"Gagal sinkronisasi massal: {str(e)}")
    finally:
        if cli:
            cli.close()
        _sync_lock.release()
