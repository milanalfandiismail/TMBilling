import json
import app.utils.logger as logger
from app import create_app


def test_logger_ignores_forwarded_header_from_lan(tmp_path, monkeypatch):
    log_file = tmp_path / "warnet.log"
    monkeypatch.setattr(logger, "LOG_FILE", str(log_file))
    app = create_app({"TESTING": True, "SECRET_KEY": "test-logger"})
    with app.test_request_context("/", headers={"X-Forwarded-For": "1.2.3.4"},
                                  environ_base={"REMOTE_ADDR": "192.168.1.10"}):
        logger.write_log("TEST", "halo")
    data = json.loads(log_file.read_text(encoding="utf-8").strip())
    assert data["ip_address"] == "192.168.1.10"
