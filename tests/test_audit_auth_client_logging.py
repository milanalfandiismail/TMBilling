import pytest
import json
from app import create_app
from app.services.auth.auth_kasir_service import AuthKasirService
from app.services.client.client_service import ClientService
from app.utils.logger import LOG_FILE

def test_auth_and_client_admin_login_logging():
    app = create_app()
    with app.app_context():
        # 1. Test validate admin check failed
        try:
            AuthKasirService.validate_admin("invalid_user", "wrong_pass")
        except ValueError:
            pass

        # 2. Test login success / failure
        try:
            AuthKasirService.login("admin", "wrong_password")
        except ValueError:
            pass

        with open(LOG_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()

        logs = [json.loads(line) for line in lines if line.strip().startswith("{")]
        actions = [l["action"] for l in logs]
        
        assert "ADMIN_CHECK_FAILED" in actions
        assert "LOGIN_GAGAL" in actions
        
        # Verify JSON details exist on the latest entries
        failed_admin_log = [l for l in logs if l["action"] == "ADMIN_CHECK_FAILED"][-1]
        assert failed_admin_log["detail_json"] is not None
        assert failed_admin_log["detail_json"]["attempted_username"] == "invalid_user"
