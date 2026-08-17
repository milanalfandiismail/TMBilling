import pytest
import json
from app import create_app
from tools.seed_audit_logs import seed_logs
from app.services.report.log_audit_service import LogAuditService

def test_full_coverage_of_audit_logging():
    app = create_app()
    with app.app_context():
        # Clear log file first to start fresh for this coverage assertion
        from app.utils.logger import LOG_FILE
        if os.path.exists(LOG_FILE):
            try:
                os.remove(LOG_FILE)
            except Exception:
                pass

        seed_logs(include_legacy=True)
        logs_data = LogAuditService.get_system_logs(limit=1000)
        logs = logs_data["logs"]
        
        actions = {l["action"] for l in logs if l.get("action")}
        
        required_actions = {
            "PAYMENT_METHOD_CONFIG", "SETTINGS_AUTO_SHUTDOWN", "CLIENT_ADMIN_LOGIN",
            "REMOTE_SCREENSHOT_TRIGGER", "VNC_START", "TOURNAMENT_CREATE", "GAME_CREATE",
            "CLEAR_LOG", "BUKA_GUEST", "BLACKOUT_DETECT", "TRANSAKSI_MENU", "TAMBAH_MEMBER"
        }
        for req in required_actions:
            assert req in actions, f"Missing required action: {req}"

        # Verify detail_json structures
        auto_shutdown_log = [l for l in logs if l["action"] == "SETTINGS_AUTO_SHUTDOWN"][-1]
        assert auto_shutdown_log["detail_json"] is not None
        assert "timer_baru" in auto_shutdown_log["detail_json"]

        payment_config_log = [l for l in logs if l["action"] == "PAYMENT_METHOD_CONFIG"][-1]
        assert payment_config_log["detail_json"] is not None
        assert "new_value" in payment_config_log["detail_json"]
import os
