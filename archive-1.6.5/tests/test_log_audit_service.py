import pytest
from app import create_app
from app.services.report.log_audit_service import LogAuditService
from app.utils.logger import write_log, read_logs

@pytest.fixture
def app_context():
    app = create_app()
    with app.app_context():
        yield app

def test_kategori_tidak_bocor_dari_baris_json_sebelumnya(monkeypatch):
    import json
    from app.services.report import log_audit_service

    baris = [
        json.dumps({"timestamp": "2026-11-08 10:00:00", "user": "a",
                    "action": "LOGIN", "detail": "x", "category": "AUTH"}),
        "[2026-11-08 10:01:00] [b] [OTHER] - y",
    ]
    monkeypatch.setattr(log_audit_service, "read_logs", lambda *a, **k: baris)

    hasil = log_audit_service.LogAuditService.get_system_logs(kategori="AUTH")

    assert len(hasil["logs"]) == 1
    assert hasil["logs"][0]["detail"] == "x"


def test_clear_system_logs_records_audit_event(app_context):
    write_log("DUMMY_EVENT", "Dummy detail", user="tester")
    
    result = LogAuditService.clear_system_logs(operator="admin_tester", archive=True)
    assert result["success"] is True
    assert "total_dibersihkan" in result
    
    # Cek bahwa baris pertama setelah clear adalah CLEAR_LOG terstruktur
    logs_data = LogAuditService.get_system_logs(limit=10)
    assert len(logs_data["logs"]) >= 1
    last_log = logs_data["logs"][0]
    assert last_log["action"] == "CLEAR_LOG"
    assert last_log["user"] == "admin_tester"
    assert last_log["detail_json"] is not None
    assert "total_dibersihkan" in last_log["detail_json"]
