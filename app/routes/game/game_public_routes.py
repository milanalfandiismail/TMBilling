# app/routes/game/game_public_routes.py

from flask import Blueprint, request, jsonify
from app.services.game.game_service import GameService

game_public_api_bp = Blueprint("game_public", __name__)

@game_public_api_bp.route("/all", methods=["GET"])
def get_public_games():
    """Mengambil daftar game yang aktif untuk konsumsi halaman publik (no login required)."""
    try:
        category = request.args.get("category")
        q = request.args.get("q")
        if q:
            q = q.strip()
            
        games = GameService.get_all(aktif_only=True, category=category, search_query=q)
        return jsonify({
            "success": True,
            "data": [g.to_dict() for g in games]
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
