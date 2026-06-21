"""IP Whitelist Middleware — proteksi akses dashboard berbasis IP.

Middleware ini dipasang sebagai @app.before_request global di app/__init__.py.
Flow: path filter → token check → auth exemption → enabled check → IP check → block.
"""

from flask import request, session as flask_session, redirect, jsonify, render_template
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
    # Ini penting: kalau user buka /kasir/?token=xxx, session harus di-set
    # SEBELUM login form dimuat (which is an exempt path).
    # =========================================================================
    if IpWhitelistService.is_enabled():
        url_token = request.args.get('token', '')
        current_token = IpWhitelistService.get_token()
        if url_token and url_token == current_token:
            IpWhitelistService.authenticate_session()
            clean_url = request.base_url  # URL without ?token=...
            return redirect(clean_url)

    # =========================================================================
    # STEP 1: Auth exemption — login page, login endpoint, check, logout
    # =========================================================================
    if request.path in ('/kasir/login',) \
       or request.path.startswith('/api/v1/kasir/auth/login') \
       or request.path.startswith('/api/v1/kasir/auth/check') \
       or request.path.startswith('/api/v1/kasir/auth/logout') \
       or request.path == '/api/v1/kasir/settings/uninstall-token/client':
        return None

    # =========================================================================
    # STEP 2: Whitelist OFF? Allow everything
    # =========================================================================
    if not IpWhitelistService.is_enabled():
        return None

    # =========================================================================
    # STEP 3: Session already authenticated via bypass token?
    # =========================================================================
    if IpWhitelistService.is_session_authenticated():
        return None

    # =========================================================================
    # STEP 4: IP in whitelist?
    # =========================================================================
    client_ip = IpWhitelistService.get_client_ip()
    if IpWhitelistService.is_ip_whitelisted(client_ip):
        return None

    # =========================================================================
    # STEP 5: BLOCK — dengan session destroy jika user sudah login
    # =========================================================================
    username = flask_session.get('kasir_username',
                                  flask_session.get('kasir_nama', 'anonymous'))
    user_role = flask_session.get('kasir_role', '')

    # Jika user belum login (no session), redirect atau 403 untuk API
    if 'kasir_id' not in flask_session:
        if request.accept_mimetypes.best == 'application/json' \
           or request.path.startswith('/api/') \
           or request.path.startswith('/kasir/api/'):
            return jsonify({'error': 'forbidden', 'ip': client_ip}), 403
        return redirect('/kasir/login')

    # Jika user memiliki session aktif, hancurkan sebelum block
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
