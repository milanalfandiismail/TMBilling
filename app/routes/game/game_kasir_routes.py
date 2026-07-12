# app/routes/game/game_kasir_routes.py

from flask import Blueprint, request, jsonify, session
from app.routes.auth.auth_kasir_routes import login_required, admin_required
from app.services.game.game_service import GameService

game_kasir_api_bp = Blueprint("game_kasir", __name__)

@game_kasir_api_bp.route("/", methods=["GET"])
@login_required
def list_games():
    """Mengambil daftar semua game (untuk panel admin kasir)."""
    try:
        category = request.args.get("category")
        q = request.args.get("q")
        if q:
            q = q.strip()
            
        games = GameService.get_all(aktif_only=False, category=category, search_query=q)
        return jsonify({
            "success": True,
            "data": [g.to_dict() for g in games]
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@game_kasir_api_bp.route("/", methods=["POST"])
@login_required
@admin_required
def tambah_game():
    """Menambahkan game baru (mendukung upload icon via multipart/form-data)."""
    try:
        # Karena menggunakan multipart/form-data untuk upload icon, baca dari request.form
        data = request.form.to_dict()
        
        # Parse boolean aktif
        if "aktif" in data:
            data["aktif"] = data["aktif"].lower() in ("true", "1", "yes")

        icon_file = request.files.get("icon")
        kasir = session.get("kasir_username", "admin")
        
        game = GameService.create(data, icon_file=icon_file, operator=kasir)
        return jsonify({
            "success": True,
            "message": f"Game '{game.nama}' berhasil ditambahkan",
            "data": game.to_dict()
        }), 201
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@game_kasir_api_bp.route("/<int:game_id>", methods=["POST", "PUT"])
@login_required
@admin_required
def edit_game(game_id):
    """Memperbarui data game (mendukung upload icon baru)."""
    try:
        # Flask request.form.to_dict() membaca field multipart
        data = request.form.to_dict()
        icon_file = request.files.get("icon")
        kasir = session.get("kasir_username", "admin")
        
        game = GameService.update(game_id, data, icon_file=icon_file, operator=kasir)
        return jsonify({
            "success": True,
            "message": f"Game '{game.nama}' berhasil diperbarui",
            "data": game.to_dict()
        }), 200
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@game_kasir_api_bp.route("/<int:game_id>", methods=["DELETE"])
@login_required
@admin_required
def hapus_game(game_id):
    """Menghapus game secara permanen dari sistem."""
    try:
        kasir = session.get("kasir_username", "admin")
        result = GameService.delete(game_id, operator=kasir)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

from app.services.game.game_kategori_service import GameKategoriService

@game_kasir_api_bp.route("/kategori", methods=["GET"])
@login_required
def list_kategori():
    try:
        kategori_list = GameKategoriService.get_all()
        return jsonify({
            "success": True,
            "data": [k.to_dict() for k in kategori_list]
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@game_kasir_api_bp.route("/kategori", methods=["POST"])
@login_required
@admin_required
def tambah_kategori():
    try:
        data = request.json or {}
        kasir = session.get("kasir_username", "admin")
        kategori = GameKategoriService.create(data, operator=kasir)
        return jsonify({
            "success": True,
            "message": f"Kategori '{kategori.nama}' berhasil ditambahkan",
            "data": kategori.to_dict()
        }), 201
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@game_kasir_api_bp.route("/kategori/<int:kategori_id>", methods=["DELETE"])
@login_required
@admin_required
def hapus_kategori(kategori_id):
    try:
        kasir = session.get("kasir_username", "admin")
        result = GameKategoriService.delete(kategori_id, operator=kasir)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
