# app/routes/tutorial/tutorial_routes.py
from flask import Blueprint, request, jsonify
from app.routes.auth.auth_kasir_routes import login_required, admin_required
from app.services import TutorialService

tutorial_api_bp = Blueprint("tutorial", __name__)

@tutorial_api_bp.route("", methods=["GET"])
@login_required
def get_tutorials():
    """GET — Ambil seluruh daftar panduan sistem."""
    try:
        tuts = TutorialService.get_all()
        return jsonify({
            "success": True,
            "tutorials": [t.to_dict() for t in tuts]
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@tutorial_api_bp.route("", methods=["POST"])
@login_required
@admin_required
def create_tutorial():
    """POST — Buat panduan baru (Khusus Admin)."""
    try:
        data = request.get_json(silent=True) or {}
        if not data.get("title") or not data.get("content"):
            return jsonify({"success": False, "error": "Judul dan isi panduan wajib diisi"}), 400

        t = TutorialService.create(data)
        return jsonify({
            "success": True,
            "message": "Panduan berhasil ditambahkan",
            "tutorial": t.to_dict()
        }), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@tutorial_api_bp.route("/<int:tutorial_id>", methods=["PUT"])
@login_required
@admin_required
def update_tutorial(tutorial_id):
    """PUT — Update panduan yang ada (Khusus Admin)."""
    try:
        data = request.get_json(silent=True) or {}
        t = TutorialService.update(tutorial_id, data)
        if not t:
            return jsonify({"success": False, "error": "Panduan tidak ditemukan"}), 404

        return jsonify({
            "success": True,
            "message": "Panduan berhasil diperbarui",
            "tutorial": t.to_dict()
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@tutorial_api_bp.route("/<int:tutorial_id>", methods=["DELETE"])
@login_required
@admin_required
def delete_tutorial(tutorial_id):
    """DELETE — Hapus panduan (Khusus Admin)."""
    try:
        ok = TutorialService.delete(tutorial_id)
        if not ok:
            return jsonify({"success": False, "error": "Panduan tidak ditemukan"}), 404

        return jsonify({
            "success": True,
            "message": "Panduan berhasil dihapus"
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
