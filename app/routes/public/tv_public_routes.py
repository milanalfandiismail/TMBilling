# app/routes/public/tv_public_routes.py

from flask import Blueprint, jsonify
from app.services.public.tv_service import TVSignageService

tv_public_api_bp = Blueprint("tv_public_api", __name__)

@tv_public_api_bp.route("/data", methods=["GET"])
def get_tv_data():
    """Endpoint to fetch real-time signage data for Smart TV lobi."""
    try:
        data = TVSignageService.get_live_data()
        return jsonify({
            "success": True,
            "data": data
        }), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500
