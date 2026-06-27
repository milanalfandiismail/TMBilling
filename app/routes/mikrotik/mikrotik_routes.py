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
        data = request.get_json() or {}
        config = MikroTikConfig.get_instance()
        
        # Update config fields
        config.enabled = bool(data.get("enabled", False))
        config.host = data.get("host", "").strip()
        config.port = int(data.get("port", 8728))
        config.username = data.get("username", "").strip()
        
        # Jangan replace password jika kosong (agar tidak hilang)
        new_pass = data.get("password")
        if new_pass is not None and str(new_pass).strip() != "":
            config.password = str(new_pass).strip()
            
        config.hotspot_profile = data.get("hotspot_profile", "default").strip()
        
        db.session.commit()
        
        write_log("MIKROTIK_CONFIG", f"Konfigurasi MikroTik diperbarui (Enabled: {config.enabled})")
        return jsonify({"success": True, "message": "Pengaturan MikroTik berhasil disimpan"}), 200
        
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
    try:
        from app.services.member.member_service import MemberService
        
        config = MikroTikConfig.get_instance()
        if not config.enabled:
            return jsonify({"error": "Integrasi MikroTik belum diaktifkan."}), 400

        host = config.host
        port = config.port
        username = config.username
        mikrotik_password = config.password
        profile = config.hotspot_profile
        
        # Test connection first
        client = MikroTikAPIClient(host, username, mikrotik_password, port)
        success, msg = client.test_connection()
        if not success:
            return jsonify({"error": f"Koneksi gagal: {msg}"}), 400

        # Ambil semua member (hanya id dan username untuk meminimalisir memory)
        members = MemberService.get_all()
        # Ambil data sederhana
        member_data = [{"username": m.username} for m in members]
        
        def background_sync(member_list, h, p, u, mp, prof):
            try:
                cli = MikroTikAPIClient(h, u, mp, p)
                if cli.login():
                    success_count = 0
                    for mem in member_list:
                        # Password set default to username since we don't have plaintext passwords
                        try:
                            cli.add_user(mem["username"], mem["username"], prof)
                            success_count += 1
                        except Exception:
                            pass # User mungkin sudah ada
                    write_log("MIKROTIK_SYNC", f"Sinkronisasi massal selesai. {success_count}/{len(member_list)} member ditambahkan.")
            except Exception as e:
                write_log("MIKROTIK_ERROR", f"Gagal sinkronisasi massal: {str(e)}")

        threading.Thread(target=background_sync, args=(member_data, host, port, username, mikrotik_password, profile), daemon=True).start()

        return jsonify({"success": True, "message": f"Sinkronisasi massal {len(member_data)} member sedang berjalan di latar belakang."}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
