"""Endpoint kesehatan publik yang hanya mengembalikan status kasar."""

from flask import Blueprint, current_app, jsonify
from app.services.health.health_service import HealthService

health_api_bp = Blueprint("health_api", __name__)


@health_api_bp.route("/health", methods=["GET"])
def health():
    try:
        return jsonify(HealthService.get_health(current_app._get_current_object())), 200
    except Exception:
        return jsonify({"status": "degraded", "checks": {"db": "down"}}), 200
