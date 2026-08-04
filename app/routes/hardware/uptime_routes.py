# app/routes/hardware/uptime_routes.py

"""Blueprint API untuk memonitor uptime PC client."""

from datetime import datetime
from flask import Blueprint, request, jsonify
from app.routes.auth.auth_kasir_routes import login_required, admin_required
from app.services.hardware.uptime_service import UptimeService
from app.utils.timezone_utils import now_utc, get_display_tz

uptime_api_bp = Blueprint("uptime_api", __name__)


@uptime_api_bp.route("/daily", methods=["GET"])
@login_required
@admin_required
def get_daily_uptime():
    """Mengambil laporan uptime harian seluruh PC.
    
    Query Parameter:
        date (str): Format YYYY-MM-DD (default hari ini).
    """
    date_str = request.args.get("date")
    tz = get_display_tz()
    
    if date_str:
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return jsonify({"success": False, "error": "Format tanggal salah. Gunakan YYYY-MM-DD"}), 400
    else:
        target_date = now_utc().astimezone(tz).date()

    report = UptimeService.get_daily_report(target_date)
    return jsonify({
        "success": True,
        "date": target_date.isoformat(),
        "report": report
    }), 200


@uptime_api_bp.route("/range", methods=["GET"])
@login_required
@admin_required
def get_range_uptime():
    """Mengambil ringkasan laporan uptime dalam rentang tanggal.
    
    Query Parameters:
        start (str): Format YYYY-MM-DD (required).
        end (str): Format YYYY-MM-DD (required).
    """
    start_str = request.args.get("start")
    end_str = request.args.get("end")

    if not start_str or not end_str:
        return jsonify({"success": False, "error": "Parameter 'start' dan 'end' wajib diisi"}), 400

    try:
        start_date = datetime.strptime(start_str, "%Y-%m-%d").date()
        end_date = datetime.strptime(end_str, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"success": False, "error": "Format tanggal salah. Gunakan YYYY-MM-DD"}), 400

    if start_date > end_date:
        return jsonify({"success": False, "error": "Tanggal mulai tidak boleh melebihi tanggal akhir"}), 400

    res = UptimeService.get_range_report(start_date, end_date)
    return jsonify(res), 200
