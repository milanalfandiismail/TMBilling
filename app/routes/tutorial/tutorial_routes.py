# app/routes/tutorial/tutorial_routes.py
from flask import Blueprint, request, jsonify
from app.routes.auth.auth_kasir_routes import login_required, admin_required
from app.services import TutorialService

tutorial_api_bp = Blueprint("tutorial", __name__)

@tutorial_api_bp.route("/", methods=["GET"], strict_slashes=False)
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

@tutorial_api_bp.route("/", methods=["POST"], strict_slashes=False)
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

@tutorial_api_bp.route("/<int:tutorial_id>", methods=["PUT"], strict_slashes=False)
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

@tutorial_api_bp.route("/<int:tutorial_id>", methods=["DELETE"], strict_slashes=False)
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

import os
import uuid
from flask import current_app

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@tutorial_api_bp.route("/categories", methods=["GET"], strict_slashes=False)
@login_required
def get_categories():
    """GET — Ambil daftar seluruh kategori unik dari panduan sistem."""
    try:
        categories = TutorialService.get_all_categories()
        return jsonify({
            "success": True,
            "categories": categories
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@tutorial_api_bp.route("/categories/<path:category_name>", methods=["DELETE"], strict_slashes=False)
@login_required
@admin_required
def delete_category(category_name):
    """DELETE — Hapus kategori dan pindahkan tutorial ke 'Kosong' (Khusus Admin)."""
    try:
        updated_count = TutorialService.delete_category(category_name)
        return jsonify({
            "success": True,
            "message": f"Kategori '{category_name}' berhasil dihapus. {updated_count} panduan dipindahkan ke kategori Kosong."
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@tutorial_api_bp.route("/upload-image", methods=["POST"], strict_slashes=False)
@login_required
@admin_required
def upload_tutorial_image():
    """POST — Upload file gambar tutorial (Khusus Admin)."""
    try:
        if 'upload' not in request.files and 'file' not in request.files:
            return jsonify({"error": "Tidak ada file gambar yang diunggah"}), 400
        
        file = request.files.get('upload') or request.files.get('file')
        if not file or file.filename == '':
            return jsonify({"error": "File gambar tidak valid"}), 400

        if not allowed_file(file.filename):
            return jsonify({"error": "Format file tidak didukung (.png, .jpg, .jpeg, .webp, .gif)"}), 400

        ext = file.filename.rsplit('.', 1)[1].lower()
        filename = f"{uuid.uuid4().hex}.{ext}"
        upload_dir = os.path.join(current_app.root_path, 'static', 'assets', 'tutorials')
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, filename)
        file.save(file_path)

        url = f"/static/assets/tutorials/{filename}"
        return jsonify({"url": url, "uploaded": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
