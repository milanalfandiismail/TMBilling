"""Routes untuk pengaturan jaringan: IP Whitelist, Cloudflare Tunnel, dan App Public URL.
"""
import os
import subprocess
import sys
from functools import wraps
from flask import request, jsonify, session, current_app
from app.services import SettingsService
from app.routes.auth.auth_kasir_routes import login_required, admin_required
from app.utils.logger import write_log
from app.services.ip_whitelist.ip_whitelist_service import IpWhitelistService
from app.routes.settings.settings_routes import settings_api_bp

# 9. IP WHITELIST (CRUD + TOGGLE + TOKEN + STATUS + PAGE)
# =========================================================================


def ip_whitelist_admin_required(f):
    """Decorator: butuh admin login + IP whitelist access."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('kasir_id') or session.get('kasir_role') != 'admin':
            return jsonify({'error': 'unauthorized'}), 401

        ip = IpWhitelistService.extract_client_ip(request.headers, request.remote_addr)
        is_ip_ok = IpWhitelistService.is_ip_whitelisted(ip)
        auth_flag = session.get('ip_wh_authenticated')
        token_ver = session.get('ip_wh_token_version')
        is_session_ok = IpWhitelistService.is_session_token_valid(auth_flag, token_ver)

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
        operator = session.get('kasir_username', 'admin')
        write_log(
            "IP_WHITELIST_ADD",
            f"IP {ip} ({label}) ditambahkan ke whitelist",
            user=operator,
            detail_json={"ip": ip, "label": label}
        )
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
        operator = session.get('kasir_username', 'admin')
        write_log(
            "IP_WHITELIST_REMOVE",
            f"IP {ip} dihapus dari whitelist",
            user=operator,
            detail_json={"ip": ip}
        )
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

        operator = session.get('kasir_username', 'admin')
        write_log(
            aksi='IP_WHITELIST_TOGGLE',
            detail=f"Whitelist {'diaktifkan' if enabled else 'dinonaktifkan'}",
            user=operator,
            detail_json={"enabled": enabled}
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
        operator = session.get('kasir_username', 'admin')
        write_log(
            "IP_WHITELIST_TOKEN_REGEN",
            f"Bypass token whitelist IP diregenerasi ke versi {version}",
            user=operator,
            detail_json={"version": version}
        )
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
        current_ip = IpWhitelistService.extract_client_ip(request.headers, request.remote_addr)
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

# ------------------------------------------------------------------
# CLOUDFLARE TUNNEL AUTO-MANAGER ENDPOINTS
# ------------------------------------------------------------------

@settings_api_bp.route("/cloudflare-tunnel/status", methods=["GET"])
@login_required
@admin_required
def cloudflare_tunnel_status():
    """GET — Status terkini dari Cloudflare Tunnel daemon."""
    try:
        from app.services import CloudflareTunnelService
        status = CloudflareTunnelService.get_status()
        return jsonify({"success": True, "status": status})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@settings_api_bp.route("/cloudflare-tunnel/save-token", methods=["POST"])
@login_required
@admin_required
def cloudflare_tunnel_save_token():
    """POST — Simpan token Cloudflare Tunnel."""
    try:
        data = request.get_json(silent=True) or {}
        token = data.get("token", "").strip()
        SettingsService.set("cloudflare_tunnel_token", token)
        write_log(
            aksi="CLOUDFLARE_TUNNEL_SAVE_TOKEN",
            detail="Token Cloudflare Tunnel diubah",
            user=session.get("kasir_username", "admin")
        )
        return jsonify({"success": True, "message": "Token Cloudflare Tunnel berhasil disimpan"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@settings_api_bp.route("/cloudflare-tunnel/toggle", methods=["POST"])
@login_required
@admin_required
def cloudflare_tunnel_toggle():
    """POST — Jalankan atau Hentikan Cloudflare Tunnel daemon."""
    try:
        data = request.get_json(silent=True) or {}
        enable = data.get("enable", False)
        from app.services import CloudflareTunnelService
        
        if enable:
            ok, msg = CloudflareTunnelService.start_tunnel()
        else:
            ok, msg = CloudflareTunnelService.stop_tunnel()

        if ok:
            write_log(
                aksi="CLOUDFLARE_TUNNEL_TOGGLE",
                detail=f"Cloudflare Tunnel {'diaktifkan' if enable else 'dinonaktifkan'}",
                user=session.get("kasir_username", "admin")
            )
            return jsonify({"success": True, "message": msg, "running": enable})
        else:
            return jsonify({"success": False, "error": msg}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

