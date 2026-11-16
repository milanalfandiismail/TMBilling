# app/routes/game/game_kasir_routes.py

from flask import Blueprint, request, jsonify, session
from app.routes.auth.auth_kasir_routes import login_required, admin_required
from app.services.game.game_service import GameService
from app.services.game.game_kategori_service import GameKategoriService

game_kasir_api_bp = Blueprint("game_kasir", __name__)

# ==================== GAME ROUTES ====================

@game_kasir_api_bp.route("/", methods=["GET"])
@login_required
@admin_required
def list_games():
    try:
        category = request.args.get("category")
        tipe = request.args.get("tipe")
        q = request.args.get("q")
        if q: q = q.strip()
            
        games = GameService.get_all(aktif_only=request.args.get("include_arsip") != "1", category=category, tipe=tipe, search_query=q)
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
    try:
        data = request.form.to_dict()
        if "aktif" in data:
            data["aktif"] = data["aktif"].lower() in ("true", "1", "yes")

        icon_file = request.files.get("icon")
        kasir = session.get("kasir_username", "admin")
        
        game = GameService.create(data, icon_file=icon_file, operator=kasir)
        tipe_label = "Aplikasi" if game.tipe == "aplikasi" else "Game"
        return jsonify({
            "success": True,
            "message": f"{tipe_label} '{game.nama}' berhasil ditambahkan",
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
    try:
        if request.is_json:
            data = request.get_json(silent=True) or {}
            icon_file = None
        else:
            data = request.form.to_dict()
            icon_file = request.files.get("icon")

        kasir = session.get("kasir_username", "admin")
        
        game = GameService.update(game_id, data, icon_file=icon_file, operator=kasir)
        tipe_label = "Aplikasi" if game.tipe == "aplikasi" else "Game"
        return jsonify({
            "success": True,
            "message": f"{tipe_label} '{game.nama}' berhasil diperbarui",
            "data": game.to_dict()
        }), 200
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@game_kasir_api_bp.route("/<int:game_id>/archive", methods=["POST"])
@login_required
@admin_required
def arsip_game(game_id):
    try:
        kasir = session.get("kasir_username", "admin")
        result = GameService.archive(game_id, operator=kasir)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@game_kasir_api_bp.route("/<int:game_id>/restore", methods=["POST"])
@login_required
@admin_required
def restore_game(game_id):
    try:
        kasir = session.get("kasir_username", "admin")
        result = GameService.restore(game_id, operator=kasir)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@game_kasir_api_bp.route("/<int:game_id>", methods=["DELETE"])
@login_required
@admin_required
def hapus_game(game_id):
    try:
        from app.models import Game, db
        game = db.session.get(Game, game_id)
        if not game:
            return jsonify({"success": False, "error": "Game tidak ditemukan"}), 404
        confirm = str((request.get_json(silent=True) or {}).get("confirm", "")).strip().lower()
        if confirm != (game.nama or "").lower():
            return jsonify({"success": False, "error": "Ketik nama game untuk konfirmasi hapus permanen"}), 400
        kasir = session.get("kasir_username", "admin")
        result = GameService.delete(game_id, operator=kasir)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ==================== KATEGORI ROUTES ====================

@game_kasir_api_bp.route("/kategori", methods=["GET"])
@login_required
@admin_required
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
