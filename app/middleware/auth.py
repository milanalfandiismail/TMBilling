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
    """Menyiapkan identitas operator remote dan disambiguasi nama cabang di session request."""
    g.is_branch_api_call = True
    remote_op = request.headers.get("X-Operator-Username", "admin")
    origin_name = request.headers.get("X-Origin-Branch-Name", "Remote").strip()
    origin_mac = request.headers.get("X-Origin-MAC", "").strip()

    from app.services.settings.settings_service import SettingsService
    local_title = SettingsService.get("warnet_title", "Cabang").strip()

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
                else:
                    return jsonify({"error": "Kunci API Cabang tidak valid"}), 403

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
