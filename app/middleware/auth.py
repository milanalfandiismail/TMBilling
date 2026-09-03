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
                g.is_branch_api_call = True
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
                    g.is_branch_api_call = True
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
