"""Pagar audit polling client: event berulang hanya dicatat sekali per TTL."""

import pytest

from app import create_app
from app.models import db
from app.services.cache.client_state_store import ClientAuditThrottle
from app.services.client import client_service


def test_should_log_suppresses_repeat_until_ttl():
    ClientAuditThrottle.clear()
    assert ClientAuditThrottle.should_log("IDENTIFY_FAIL", "10.0.0.1") is True
    assert ClientAuditThrottle.should_log("IDENTIFY_FAIL", "10.0.0.1") is False
    assert ClientAuditThrottle.should_log("IDENTIFY_FAIL", "10.0.0.1", ttl_seconds=0) is True
    assert ClientAuditThrottle.should_log("IDENTIFY_FAIL", "10.0.0.2") is True
    assert ClientAuditThrottle.should_log("STATUS_REJECTED", "10.0.0.1") is True


def test_log_repeated_writes_once_and_accepts_empty_key(monkeypatch):
    ClientAuditThrottle.clear()
    written = []
    monkeypatch.setattr(client_service, "write_log", lambda event, message: written.append(event))
    client_service._log_repeated("CLIENT_STATUS_CRASH", None, "boom-1")
    client_service._log_repeated("CLIENT_STATUS_CRASH", None, "boom-2")
    assert written == ["CLIENT_STATUS_CRASH"]


def test_polling_unknown_pc_logs_unknown_once(monkeypatch):
    app = create_app({"TESTING": True, "WTF_CSRF_ENABLED": False,
                      "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    written = []
    with app.app_context():
        db.create_all()
        ClientAuditThrottle.clear()
        monkeypatch.setattr(client_service, "write_log",
                            lambda event, message: written.append(event))
        first = client_service.ClientService.get_status("10.9.9.9", "AABBCCDDEEFF")
        second = client_service.ClientService.get_status("10.9.9.9", "AABBCCDDEEFF")
        db.session.remove()

    assert first["status"] == "kosong"
    assert second["status"] == "kosong"
    assert written.count("CLIENT_STATUS_UNKNOWN") == 1
