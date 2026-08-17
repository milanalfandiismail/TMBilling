import os
import json
import gzip
import pytest
from app.utils.logger import (
    LOG_FILE,
    normalize_legacy_log_line,
    archive_logs,
    clear_logs,
    write_log,
)

def test_normalize_legacy_log_line():
    legacy_line = "[2026-08-15 10:00:00] [kasir_1] BUKA_MEMBER - PC-01"
    normalized = normalize_legacy_log_line(legacy_line)
    assert normalized["timestamp"] == "2026-08-15 10:00:00"
    assert normalized["user"] == "kasir_1"
    assert normalized["action"] == "BUKA_MEMBER"
    assert normalized["detail"] == "PC-01"

def test_normalize_json_log_line():
    json_line = json.dumps({
        "timestamp": "2026-08-15 11:00:00",
        "user": "admin",
        "action": "TAMBAH_MEMBER",
        "detail": "Member test",
        "detail_json": {"username": "test"}
    })
    normalized = normalize_legacy_log_line(json_line)
    assert normalized["user"] == "admin"
    assert normalized["detail_json"] == {"username": "test"}

def test_clear_logs_with_archive():
    # Tulis dummy log
    write_log("TEST_ACTION", "Testing log line", user="tester")
    assert os.path.exists(LOG_FILE)
    
    result = clear_logs(archive=True)
    assert result["success"] is True
    assert result["total_lines"] >= 1
    assert result["archive_path"] is not None
    assert os.path.exists(result["archive_path"])
    
    # Pastikan file utama kosong
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    assert content == ""
