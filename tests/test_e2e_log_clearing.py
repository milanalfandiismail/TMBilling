import pytest
from app import create_app
from app.utils.logger import write_log, LOG_FILE
from app.services.report.log_audit_service import LogAuditService
from tools.seed_audit_logs import seed_logs

def test_full_log_cycle():
    app = create_app()
    with app.app_context():
        # 1. Suntikkan sample log dari seed tool (mencakup 12 domain)
        seed_logs(include_legacy=True)
        
        # 2. Clear log dengan archive
        result = LogAuditService.clear_system_logs(operator="superadmin", archive=True)
        assert result["success"] is True
        assert result["total_dibersihkan"] >= 15
        assert result["archive_path"] is not None
        
        # 3. Verifikasi log setelah clear berisi CLEAR_LOG terstruktur
        logs_res = LogAuditService.get_system_logs(limit=5)
        assert len(logs_res["logs"]) == 1
        assert logs_res["logs"][0]["action"] == "CLEAR_LOG"
        assert logs_res["logs"][0]["user"] == "superadmin"
        assert logs_res["logs"][0]["detail_json"]["total_dibersihkan"] >= 15
