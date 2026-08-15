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
