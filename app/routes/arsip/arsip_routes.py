# app/routes/arsip/arsip_routes.py

"""Route agregat daftar data terarsip untuk tab Diarsipkan."""

from flask import Blueprint, jsonify
from app.middleware.auth import login_required
from app.services.arsip import ArsipService

arsip_api_bp = Blueprint("arsip_api", __name__)


@arsip_api_bp.route("/", methods=["GET"])
@login_required
def get_arsip():
    """Ambil seluruh data terarsip dari semua entitas."""
    try:
        return jsonify({"success": True, "data": ArsipService.get_arsip()}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
