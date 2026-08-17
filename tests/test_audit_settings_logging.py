import pytest
import json
from app import create_app
from app.utils.logger import LOG_FILE

def test_settings_and_payment_methods_logging():
    app = create_app()
    app.config["WTF_CSRF_ENABLED"] = False
    client = app.test_client()
    with client.session_transaction() as sess:
        sess["kasir_id"] = 1
        sess["kasir_username"] = "admin_test"
        sess["kasir_role"] = "admin"

    # 1. Test update auto shutdown
    res = client.put("/api/v1/kasir/settings/auto-shutdown", json={"timer_seconds": 240})
    assert res.status_code == 200

    # 2. Test update generic setting / payment methods
    res = client.put("/api/v1/kasir/settings/payment_methods", json={"value": "Tunai,QRIS,Transfer Bank,Debit"})
    assert res.status_code == 200

    with open(LOG_FILE, "r", encoding="utf-8") as f:
        lines = f.readlines()

    logs = [json.loads(line) for line in lines if line.strip().startswith("{")]
    actions = [l["action"] for l in logs]
    # We assert that either they are there or we will write them in implementation
    assert "SETTINGS_AUTO_SHUTDOWN" in actions
    assert "PAYMENT_METHOD_CONFIG" in actions
