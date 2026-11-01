# app/routes/monitor/vnc_client_routes.py

"""Routes untuk proxy kontrol VNC client PC warnet dari kasir.

Endpoint ini mendelegasikan start, stop, dan pengecekan status
service TightVNC pada client PC ke vnc_routes.
"""

from app.middleware.auth import login_required, admin_required, shift_required


def register_vnc_client_routes(bp):
    """Mendaftarkan route VNC client ke Blueprint monitor_kasir."""

    @bp.route("/vnc_client/<int:pc_id>/start", methods=["POST"])
    @login_required
    @admin_required
    @shift_required
    def start_vnc_client(pc_id):
        from app.routes.vnc.vnc_routes import handle_start_vnc_client
        return handle_start_vnc_client(pc_id)

    @bp.route("/vnc_client/<int:pc_id>/stop", methods=["POST"])
    @login_required
    @admin_required
    @shift_required
    def stop_vnc_client(pc_id):
        from app.routes.vnc.vnc_routes import handle_stop_vnc_client
        return handle_stop_vnc_client(pc_id)

    @bp.route("/vnc_client/<int:pc_id>/status", methods=["GET"])
    @login_required
    @admin_required
    def status_vnc_client(pc_id):
        from app.routes.vnc.vnc_routes import handle_status_vnc_client
        return handle_status_vnc_client(pc_id)
