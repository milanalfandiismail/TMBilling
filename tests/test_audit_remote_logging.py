import pytest
import json
from app import create_app
from app.utils.logger import LOG_FILE

def test_remote_actions_logging():
    app = create_app()
    app.config["WTF_CSRF_ENABLED"] = False
    client = app.test_client()
    with client.session_transaction() as sess:
        sess["kasir_id"] = 1
        sess["kasir_username"] = "admin_remote"
        sess["kasir_role"] = "admin"

    # Start VNC proxy
    res = client.post("/api/v1/kasir/vnc/start")
    assert res.status_code in [200, 400]

    with open(LOG_FILE, "r", encoding="utf-8") as f:
        lines = f.readlines()

    logs = [json.loads(line) for line in lines if line.strip().startswith("{")]
    actions = [l["action"] for l in logs]
    
    assert "VNC_START" in actions
    
    latest_vnc_log = [l for l in logs if l["action"] == "VNC_START"][-1]
    assert latest_vnc_log["user"] == "admin_remote"
    assert latest_vnc_log["detail_json"] is not None
