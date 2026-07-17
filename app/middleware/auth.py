# app/middleware/auth.py

"""Middleware dan dekorator untuk autentikasi dan otorisasi kasir/admin."""

from functools import wraps
from flask import session, jsonify, redirect

def clear_kasir_session():
    """Pembersihan session kasir secara terpusat (DRY)."""
    session.pop("kasir_id", None)
    session.pop("kasir_username", None)
    session.pop("kasir_role", None)
    session.pop("kasir_nama", None)


def login_required(f):
    """Decorator untuk proteksi endpoint API JSON (Return 401)."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        """Wrapper untuk validasi session API."""
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
    """Decorator khusus Admin. Wajib pasang @login_required sebelumnya."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
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
