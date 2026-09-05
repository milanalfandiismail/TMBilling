# app/middleware/branch_proxy.py
"""Middleware hook untuk mencegat dan merelay request kasir ke cabang remote."""

from flask import request, session, jsonify
from app.services.branch.branch_proxy_service import BranchProxyService


def handle_branch_proxy_relay():
    """Memeriksa dan mengeksekusi reverse proxy relay ke cabang remote jika X-Branch-ID disematkan."""
    branch_id = BranchProxyService.should_relay(request)
    if branch_id is None:
        return None

    # Verifikasi hak akses Admin untuk penggunaan relay lintas cabang
    kasir_id = session.get("kasir_id")
    if not kasir_id:
        return jsonify({
            "status": "error",
            "error": "Silakan login terlebih dahulu untuk mengakses cabang remote"
        }), 401

    if session.get("kasir_role") != "admin":
        return jsonify({
            "status": "error",
            "error": "Akses kontrol multi-cabang hanya diizinkan untuk Admin/Owner"
        }), 403

    # Jalankan relay request ke remote server
    return BranchProxyService.relay_request(branch_id, request)
