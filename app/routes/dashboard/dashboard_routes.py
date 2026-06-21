# app/routes/dashboard_routes.py

"""Routes untuk dashboard kasir.

Blueprint ini menyediakan endpoint untuk halaman utama dashboard
dan API data PC untuk grid monitoring.
"""

from flask import Blueprint, request, jsonify, render_template, redirect, session, url_for
from app.routes.auth.auth_kasir_routes import login_required, login_required_html, admin_required
from app.services import DashboardService
from app.services import SettingsService
from app.services.owner.analytics_service import OwnerAnalyticsService
from app.utils.timezone_utils import get_tz_short_name

dashboard_bp = Blueprint("dashboard", __name__)
dashboard_api_bp = Blueprint("dashboard_api", __name__)


# =========================================================================
# 1. PAGE RENDERING (HTML VIEWS)
# =========================================================================
# Fokus: Melayani permintaan halaman web (Browser) dan pengalihan login.

@dashboard_bp.route("/", methods=["GET"])
@login_required_html
def dashboard():
    """Halaman utama dashboard monitoring PC kasir."""
    timezone = SettingsService.get("timezone", "Asia/Makassar")
    tz_label = get_tz_short_name(timezone)
    return render_template("kasir/index.html", user_timezone=timezone, user_timezone_label=tz_label)

@dashboard_bp.route("/login", methods=["GET"])
def login_page():
    """Halaman login khusus kasir/admin."""
    # Jika sudah ada session, cek keaktifan di database
    kasir_id = session.get("kasir_id")
    if kasir_id:
        from app.repositories import UserRepository
        user = UserRepository.get_by_id(kasir_id)
        if user and user.aktif:
            return redirect(url_for('dashboard.dashboard'))
        else:
            # Session tidak valid/user tidak aktif/dihapus, bersihkan session!
            session.pop("kasir_id", None)
            session.pop("kasir_username", None)
            session.pop("kasir_role", None)
            session.pop("kasir_nama", None)
    return render_template("kasir/login.html")


# =========================================================================
# 2. BACKEND API (JSON DATA)
# =========================================================================
# Fokus: Menyediakan data real-time untuk diolah oleh JavaScript di frontend.

@dashboard_api_bp.route("/pc", methods=["GET"])
@login_required
def list_pc_api():
    """Endpoint API untuk mengambil status semua PC (Online, Sesi, Grup)."""
    try:
        # Memanggil DashboardService untuk agregasi data PC & Sesi
        result = DashboardService.get_pc_list()
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@dashboard_api_bp.route("/analytics", methods=["GET"])
@login_required
@admin_required
def analytics_data():
    """Endpoint API untuk data analytics owner."""
    try:
        start = request.args.get('start')
        end = request.args.get('end')
        data = OwnerAnalyticsService.get_all_analytics(start, end)
        return jsonify({"success": True, "data": data})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500