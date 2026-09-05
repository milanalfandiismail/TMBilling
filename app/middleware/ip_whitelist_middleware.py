"""IP Whitelist Middleware — proteksi akses dashboard berbasis IP.

Middleware ini dipasang sebagai @app.before_request global di app/__init__.py.
Flow: path filter → token check → auth exemption → enabled check → IP check → block.
"""

from flask import request, session as flask_session, redirect, jsonify
from app.services.ip_whitelist.ip_whitelist_service import IpWhitelistService
from app.utils.logger import write_log


def _skip_static(path):
    return path.startswith('/static/')


def check_ip_whitelist():
    """Hook before_request untuk cek IP whitelist."""

    # --- Skip path filter: di luar scope? Nothing to do ---
    if not IpWhitelistService.is_path_in_scope(request.path):
        return None

    # Static assets — always allow
    if _skip_static(request.path):
        return None

    # =========================================================================
    # STEP 0: Token bypass — proses token even before auth exemption.
    # =========================================================================
    if IpWhitelistService.is_enabled():
        url_token = request.args.get('token', '')
        current_token = IpWhitelistService.get_token()
        if url_token and url_token == current_token:
            flask_session['ip_wh_authenticated'] = True
            flask_session['ip_wh_token_version'] = IpWhitelistService.get_token_version()
            clean_url = request.base_url  # URL without ?token=...
            return redirect(clean_url)

    # =========================================================================
    # STEP 1: Auth exemption — login page, login endpoint, check, logout & Bearer Branch Relay
    # =========================================================================
    if request.path in ('/kasir/login',) \
       or request.path.startswith('/api/v1/kasir/auth/login') \
       or request.path.startswith('/api/v1/kasir/auth/check') \
       or request.path.startswith('/api/v1/kasir/auth/logout') \
       or request.path == '/api/v1/kasir/settings/uninstall-token/client':
        return None

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        import secrets
        from app.services.settings.settings_service import SettingsService
        local_key = SettingsService.get_or_create_branch_api_key()
        if local_key and secrets.compare_digest(token, local_key):
            return None

    # =========================================================================
    # STEP 2: Whitelist OFF? Allow everything
    # =========================================================================
    if not IpWhitelistService.is_enabled():
        return None

    # =========================================================================
    # STEP 3: Admin role or session authenticated via bypass token?
    # =========================================================================
    if flask_session.get('kasir_role') == 'admin':
        return None

    auth_flag = flask_session.get('ip_wh_authenticated')
    token_ver = flask_session.get('ip_wh_token_version')
    if IpWhitelistService.is_session_token_valid(auth_flag, token_ver):
        return None


    # =========================================================================
    # STEP 4: IP in whitelist?
    # =========================================================================
    client_ip = IpWhitelistService.extract_client_ip(request.headers, request.remote_addr)
    if IpWhitelistService.is_ip_whitelisted(client_ip):
        return None

    # =========================================================================
    # STEP 5: BLOCK — dengan session destroy jika user sudah login
    # =========================================================================
    username = flask_session.get('kasir_username',
                                  flask_session.get('kasir_nama', 'anonymous'))
    user_role = flask_session.get('kasir_role', '')

    if 'kasir_id' not in flask_session:
        if request.accept_mimetypes.best == 'application/json' \
           or request.path.startswith('/api/') \
           or request.path.startswith('/kasir/api/'):
            return jsonify({'error': 'forbidden', 'ip': client_ip}), 403
        return redirect('/kasir/login')

    write_log(
        aksi='IP_WHITELIST_SESSION_DESTROY',
        detail=f"Session user {username} ({user_role}) dari IP {client_ip} "
               f"dihancurkan karena IP dihapus dari whitelist",
        user=username
    )
    flask_session.clear()
    flask_session.modified = True

    write_log(
        aksi='IP_WHITELIST_BLOCK',
        detail=f"IP {client_ip} diblokir mengakses {request.path} (method: {request.method})",
        user='anonymous'
    )

    if request.accept_mimetypes.best == 'application/json' \
       or request.path.startswith('/api/') \
       or request.path.startswith('/kasir/api/'):
        return jsonify({'error': 'forbidden', 'ip': client_ip}), 403

    return redirect('/kasir/login')
