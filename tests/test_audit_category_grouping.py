import pytest
import os
import json
from app import create_app
from app.utils.logger import write_log, ACTION_TO_CATEGORY_MAP

def test_logger_category_mapping_exists():
    # Verify taxonomy dictionary exists and is populated
    assert isinstance(ACTION_TO_CATEGORY_MAP, dict)
    assert len(ACTION_TO_CATEGORY_MAP) >= 130
    assert ACTION_TO_CATEGORY_MAP.get("LOGIN") == "AUTHENTICATION"
    assert ACTION_TO_CATEGORY_MAP.get("PAYMENT_METHOD_CONFIG") == "PAYMENT_BILLING"

def test_write_log_injects_category():
    app = create_app()
    with app.app_context():
        from app.utils.logger import LOG_FILE
        if os.path.exists(LOG_FILE):
            try:
                os.remove(LOG_FILE)
            except Exception:
                pass

        # Write a log without explicit category
        write_log("LOGIN", "Kasir login", user="admin")
        
        # Read the log line
        with open(LOG_FILE, "r", encoding="utf-8") as f:
            line = f.readline().strip()
            data = json.loads(line)
            assert data["action"] == "LOGIN"
            assert data["category"] == "AUTHENTICATION"

        # Write a log with explicit category override
        write_log("CUSTOM_ACTION", "Custom detail", user="admin", category="CUSTOM_CATEGORY")
        with open(LOG_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()
            line = lines[-1].strip()
            data = json.loads(line)
            assert data["action"] == "CUSTOM_ACTION"
            assert data["category"] == "CUSTOM_CATEGORY"

def test_service_category_filtering():
    app = create_app()
    with app.app_context():
        from app.utils.logger import LOG_FILE
        from app.services.report.log_audit_service import LogAuditService
        if os.path.exists(LOG_FILE):
            try:
                os.remove(LOG_FILE)
            except Exception:
                pass

        # Write multiple logs of different categories
        write_log("LOGIN", "User logged in", user="admin")
        write_log("BUKA_GUEST", "PC opened", user="admin")
        
        # Query for AUTHENTICATION category
        result = LogAuditService.get_system_logs(kategori="AUTHENTICATION")
        assert len(result["logs"]) == 1
        assert result["logs"][0]["action"] == "LOGIN"
        assert result["logs"][0]["category"] == "AUTHENTICATION"

        # Query for SESI_BILLING category
        result_sesi = LogAuditService.get_system_logs(kategori="SESI_BILLING")
        assert len(result_sesi["logs"]) == 1
        assert result_sesi["logs"][0]["action"] == "BUKA_GUEST"
        assert result_sesi["logs"][0]["category"] == "SESI_BILLING"

        # Check legacy compatibility aliases for UI dropdown compatibility
        # transaksi maps to TRANSACTION / PAYMENT_BILLING
        # sesi maps to SESI_BILLING
        result_legacy = LogAuditService.get_system_logs(kategori="sesi")
        assert len(result_legacy["logs"]) == 1
        assert result_legacy["logs"][0]["action"] == "BUKA_GUEST"

