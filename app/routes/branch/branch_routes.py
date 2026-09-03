# app/routes/branch/branch_routes.py
"""Routes API untuk manajemen koneksi cabang warnet (Multi-Cabang)."""

from flask import Blueprint, request, jsonify
from app.middleware.auth import login_required, admin_required
from app.services.branch.branch_service import BranchService
from app.services.settings.settings_service import SettingsService

branch_api_bp = Blueprint("branch_api", __name__)


@branch_api_bp.route("/my-key", methods=["GET"])
@login_required
@admin_required
def get_my_branch_key():
    """Mengambil API Key rahasia cabang lokal ini."""
    api_key = SettingsService.get_or_create_branch_api_key()
    return jsonify({
        "success": True,
        "data": {
            "api_key": api_key
        }
    }), 200


@branch_api_bp.route("/my-key/regenerate", methods=["POST"])
@login_required
@admin_required
def regenerate_my_branch_key():
    """Membuat ulang API Key rahasia cabang lokal ini."""
    new_key = SettingsService.regenerate_branch_api_key()
    return jsonify({
        "success": True,
        "message": "API Key cabang berhasil di-regenerate",
        "data": {
            "api_key": new_key
        }
    }), 200


@branch_api_bp.route("/list", methods=["GET"])
@login_required
@admin_required
def list_branches():
    """Mengambil daftar seluruh cabang yang terhubung."""
    include_key = request.args.get("include_key", "0") == "1"
    branches = BranchService.get_all_branches(include_key=include_key)
    return jsonify({
        "success": True,
        "data": branches
    }), 200


@branch_api_bp.route("/add", methods=["POST"])
@login_required
@admin_required
def add_branch():
    """Mendaftarkan koneksi cabang baru."""
    payload = request.get_json() or {}
    url = payload.get("url", "")
    api_key = payload.get("api_key", "")
    nama = payload.get("nama")

    ok, result = BranchService.add_branch(url=url, api_key=api_key, nama=nama)
    if not ok:
        return jsonify({
            "success": False,
            "error": result
        }), 400

    return jsonify({
        "success": True,
        "message": "Cabang berhasil ditambahkan",
        "data": result
    }), 200


@branch_api_bp.route("/<int:branch_id>", methods=["PUT"])
@login_required
@admin_required
def update_branch(branch_id: int):
    """Memperbarui informasi koneksi cabang."""
    payload = request.get_json() or {}
    ok, result = BranchService.update_branch(branch_id, payload)
    if not ok:
        return jsonify({
            "success": False,
            "error": result
        }), 400

    return jsonify({
        "success": True,
        "message": "Cabang berhasil diperbarui",
        "data": result
    }), 200


@branch_api_bp.route("/<int:branch_id>", methods=["DELETE"])
@login_required
@admin_required
def delete_branch(branch_id: int):
    """Menghapus koneksi cabang."""
    ok, message = BranchService.delete_branch(branch_id)
    if not ok:
        return jsonify({
            "success": False,
            "error": message
        }), 400

    return jsonify({
        "success": True,
        "message": message
    }), 200


@branch_api_bp.route("/test", methods=["POST"])
@login_required
@admin_required
def test_branch_connection():
    """Menguji koneksi ke URL & API Key target tanpa menyimpannya."""
    payload = request.get_json() or {}
    url = payload.get("url", "")
    api_key = payload.get("api_key", "")

    ok, result = BranchService.test_connection(url=url, api_key=api_key)
    if not ok:
        return jsonify({
            "success": False,
            "error": result
        }), 400

    return jsonify({
        "success": True,
        "data": result
    }), 200
