# app/routes/user_routes.py

"""Routes untuk CRUD User (Admin/Kasir).

Blueprint ini menangani pengelolaan akun staff warnet.
Hanya dapat diakses oleh role "admin".
"""

from flask import Blueprint, request, jsonify, session
from app.services.user_service import UserService
from app.routes.auth_kasir_routes import login_required, admin_required

user_bp = Blueprint("user", __name__)


@user_bp.route("/", methods=["GET"])
@login_required
@admin_required
def get_all_users():
    """Ambil daftar semua user kasir/admin."""
    try:
        users = UserService.get_all_users()
        return jsonify(users), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@user_bp.route("/<int:user_id>", methods=["GET"])
@login_required
@admin_required
def get_user(user_id):
    """Ambil data detail satu user."""
    try:
        user = UserService.get_user(user_id)
        return jsonify(user), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@user_bp.route("/", methods=["POST"])
@login_required
@admin_required
def create_user():
    """Buat akun staff baru."""
    data = request.get_json() or {}
    operator = session.get("kasir_username", "admin")
    try:
        new_user = UserService.create_user(data, operator)
        return jsonify({"success": True, "user": new_user, "message": "User berhasil ditambahkan"}), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Internal Error: {str(e)}"}), 500


@user_bp.route("/<int:user_id>", methods=["PUT"])
@login_required
@admin_required
def update_user(user_id):
    """Perbarui profil staff (termasuk ganti password/role)."""
    data = request.get_json() or {}
    operator = session.get("kasir_username", "admin")
    try:
        updated_user = UserService.update_user(user_id, data, operator)
        return jsonify({"success": True, "user": updated_user, "message": "Data staff diperbarui"}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Internal Error: {str(e)}"}), 500


@user_bp.route("/<int:user_id>", methods=["DELETE"])
@login_required
@admin_required
def delete_user(user_id):
    """Hapus permanen akun staff."""
    operator = session.get("kasir_username", "admin")
    try:
        result = UserService.delete_user(user_id, operator)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Internal Error: {str(e)}"}), 500
