# app/middleware/auth.py

"""Middleware dan dekorator untuk autentikasi dan otorisasi kasir/admin."""

from functools import wraps
import logging
from flask import session, jsonify, redirect, request, g

logger = logging.getLogger(__name__)

def clear_kasir_session():
    """Pembersihan session kasir secara terpusat (DRY)."""
    session.pop("kasir_id", None)
    session.pop("kasir_username", None)
    session.pop("kasir_role", None)
    session.pop("kasir_nama", None)


def login_required(f):
    """Decorator untuk proteksi endpoint API JSON kasir."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        kasir_id = session.get("kasir_id")
        if not kasir_id:
            return jsonify({"error": "Silakan login terlebih dahulu"}), 401
            
        from app.repositories import UserRepository
        user = UserRepository.get_by_id(kasir_id)
        if not user or not user.aktif:
            clear_kasir_session()
            return jsonify({"error": "Sesi tidak valid, silakan login kembali"}), 401

        g.kasir_user = user
        if session.get("kasir_role") != user.role:
            session["kasir_role"] = user.role
        session.permanent = True
        return f(*args, **kwargs)
    return decorated_function


def admin_required(f):
    """Decorator khusus Admin."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = getattr(g, "kasir_user", None)
        if user is None:
            from app.repositories import UserRepository
            user = UserRepository.get_by_id(session.get("kasir_id"))
        if not user or not user.aktif or user.role != "admin":
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
            
        session.permanent = True
        return f(*args, **kwargs)
    return decorated_function


def shift_required(f):
    """Decorator untuk mewajibkan shift aktif bagi pengguna ber-role kasir sebelum bertransaksi.

    Role admin dibebaskan dari kewajiban membuka shift (dapat bertransaksi kapan saja).
    Jika pengguna adalah kasir dan belum memiliki shift aktif, request ditolak dengan HTTP 400.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if session.get("kasir_role") == "admin":
            return f(*args, **kwargs)

        if session.get("kasir_role") == "kasir":
            kasir_username = session.get("kasir_username")
            from app.services.shift.shift_service import ShiftService
            active_shift = ShiftService.get_active_shift(kasir_username)
            if not active_shift:
                return jsonify({
                    "error": "Harap buka shift terlebih dahulu sebelum melayani transaksi."
                }), 400

        return f(*args, **kwargs)
    return decorated_function
