# app/middleware/auth.py

"""Middleware dan dekorator untuk autentikasi dan otorisasi kasir/admin."""

from functools import wraps
import secrets
from flask import session, jsonify, redirect, request, g

def clear_kasir_session():
    """Pembersihan session kasir secara terpusat (DRY)."""
    session.pop("kasir_id", None)
    session.pop("kasir_username", None)
    session.pop("kasir_role", None)
    session.pop("kasir_nama", None)


def _apply_branch_relay_identity():
    """Menyiapkan identitas operator remote, mencatat riwayat inbound, dan cek status blokir."""
    g.is_branch_api_call = True
    remote_op = request.headers.get("X-Operator-Username", "admin")
    origin_name = request.headers.get("X-Origin-Branch-Name", "").strip()
    origin_mac = request.headers.get("X-Origin-MAC", "").strip()
    origin_url = request.headers.get("X-Origin-URL", "").strip()
    sender_ip = request.headers.get("X-Forwarded-For", request.remote_addr or "").split(",")[0].strip()

    from app.services.settings.settings_service import SettingsService
    local_title = (SettingsService.get("warnet_title") or "TMBilling").strip()
    if not local_title or local_title.lower() == "cabang":
        local_title = "TMBilling"

    # Resolusi Nama Warnet Pengirim jika kosong atau hanya placeholder 'Cabang' / 'Remote'
    if not origin_name or origin_name.lower() in ("cabang", "remote"):
        matched_branch_name = None
        try:
            from app.models.branch import Branch
            if sender_ip and sender_ip not in ("127.0.0.1", "localhost", "::1"):
                # Cari cabang terdaftar yang URL-nya mengandung sender_ip
                matched = Branch.query.filter(Branch.url.contains(sender_ip), Branch.aktif == True).first()
                if matched and matched.nama:
                    matched_branch_name = matched.nama.strip()
        except Exception:
            pass

        if matched_branch_name and matched_branch_name.lower() not in ("cabang", "remote"):
            origin_name = matched_branch_name
        else:
            origin_name = "TMBilling"

    # Cek apakah cabang ini diblokir dari akses masuk
    from app.services.branch.branch_inbound_service import BranchInboundService
    if BranchInboundService.is_blocked(origin_name=origin_name, origin_mac=origin_mac):
        g.is_branch_blocked = True
        return

    # Catat atau perbarui aktivitas koneksi inbound
    try:
        BranchInboundService.record_inbound_access(
            origin_name=origin_name,
            origin_mac=origin_mac,
            origin_url=origin_url,
            operator=remote_op,
            ip_address=sender_ip
        )
    except Exception:
        pass

    # Cek apakah nama warnet pengirim sama dengan warnet lokal
    is_name_conflict = (origin_name.lower() == local_title.lower())
    if not is_name_conflict:
        try:
            from app.models.branch import Branch
            if Branch.query.filter(Branch.nama.ilike(origin_name)).count() > 1:
                is_name_conflict = True
        except Exception:
            pass

    # Disambiguasi: Jika nama warnet sama/bentrok dan ada MAC address, sertakan tag MAC fisik
    if is_name_conflict and origin_mac:
        full_operator = f"{remote_op} (Remote: {origin_name} [MAC: {origin_mac}])"
    else:
        full_operator = f"{remote_op} (Remote: {origin_name})"

    from app.repositories import UserRepository
    first_admin = UserRepository.get_first_admin()
    if first_admin:
        session["kasir_id"] = first_admin.id
    session["kasir_username"] = full_operator
    session["kasir_role"] = "admin"


def login_required(f):
    """Decorator untuk proteksi endpoint API JSON (Mendukung Sesi Kasir & Bearer API Key Lintas Cabang)."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # 1. Cek otentikasi via Bearer Token (Akses Lintas Cabang / Multi-Branch)
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1].strip()
            from app.services.settings.settings_service import SettingsService
            local_key = SettingsService.get_or_create_branch_api_key()
            if local_key and secrets.compare_digest(token, local_key):
                _apply_branch_relay_identity()
                if getattr(g, "is_branch_blocked", False):
                    return jsonify({"error": "Akses cabang ditolak: Cabang Anda telah diblokir oleh server target."}), 403
                return f(*args, **kwargs)
            return jsonify({"error": "Kunci API Cabang tidak valid"}), 403

        # 2. Cek validasi session browser kasir
        kasir_id = session.get("kasir_id")
        if not kasir_id:
            return jsonify({"error": "Silakan login terlebih dahulu"}), 401
            
        from app.repositories import UserRepository
        user = UserRepository.get_by_id(kasir_id)
        if not user or not user.aktif:
            clear_kasir_session()
            return jsonify({"error": "Sesi tidak valid, silakan login kembali"}), 401
            
        return f(*args, **kwargs)
    return decorated_function


def admin_required(f):
    """Decorator khusus Admin. Mendukung Sesi Admin & Bearer API Key Lintas Cabang."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # 1. Jika belum dievaluasi oleh login_required, cek Bearer header di sini
        if not hasattr(g, "is_branch_api_call"):
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ", 1)[1].strip()
                from app.services.settings.settings_service import SettingsService
                local_key = SettingsService.get_or_create_branch_api_key()
                if local_key and secrets.compare_digest(token, local_key):
                    _apply_branch_relay_identity()
                    if getattr(g, "is_branch_blocked", False):
                        return jsonify({"error": "Akses cabang ditolak: Cabang Anda telah diblokir oleh server target."}), 403
                else:
                    return jsonify({"error": "Kunci API Cabang tidak valid"}), 403

        if getattr(g, "is_branch_blocked", False):
            return jsonify({"error": "Akses cabang ditolak: Cabang Anda telah diblokir oleh server target."}), 403

        # Request dari branch API otomatis memiliki hak akses admin lintas cabang
        if getattr(g, "is_branch_api_call", False):
            return f(*args, **kwargs)
        if session.get("kasir_role") != "admin":
            return jsonify({"error": "Akses Ditolak. Hanya Admin yang diizinkan."}), 403
        return f(*args, **kwargs)
    return decorated_function


def login_required_html(f):
    """Decorator untuk proteksi endpoint Halaman HTML (Redirect ke Login)."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        """Wrapper untuk validasi session HTML."""
        kasir_id = session.get("kasir_id")
        if not kasir_id:
            return redirect("/kasir/login")
            
        from app.repositories import UserRepository
        user = UserRepository.get_by_id(kasir_id)
        if not user or not user.aktif:
            clear_kasir_session()
            return redirect("/kasir/login")
            
        return f(*args, **kwargs)
    return decorated_function
