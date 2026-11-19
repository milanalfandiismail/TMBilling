import pytest
from app import create_app
from app.services.hardware.hardware_service import HardwareService


@pytest.fixture
def app_client(monkeypatch):
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "SECRET_KEY": "test-monitor-ip",
        "CLIENT_API_KEY": "test-key",
    })
    calls = {}
    monkeypatch.setattr(
        HardwareService,
        "process_hardware_metric",
        staticmethod(lambda ip, data: calls.update(ip=ip) or {"kode": "PC-A"}),
    )
    with app.app_context():
        yield app.test_client(), calls


def test_telemetry_uses_peer_ip_not_body(app_client):
    client, calls = app_client
    res = client.post(
        "/api/v1/public/monitor/",
        json={"IpAddress": "10.0.0.99", "CpuUsage": 10},
        headers={"X-Client-Key": "test-key", "X-Forwarded-For": "10.0.0.2"},
        environ_base={"REMOTE_ADDR": "127.0.0.1"},
    )
    assert res.status_code == 200
    assert calls["ip"] == "10.0.0.2"
