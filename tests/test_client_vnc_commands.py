import pytest
from app import create_app, db
from app.models import PC, Grup
from app.services.client.client_service import ClientService, PENDING_VNC_COMMANDS
from app.services.vnc.vnc_service import VNCClientProxyService

@pytest.fixture
def client_app():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["CLIENT_API_KEY"] = "TM2026QWERTY-api-key"
    with app.app_context():
        db.create_all()
        grup = Grup(nama="VIP")
        db.session.add(grup)
        db.session.commit()
        pc = PC(kode="PC-01", ip_address="192.168.1.101", mac_address="AA:BB:CC:DD:EE:01", grup_id=grup.id)
        db.session.add(pc)
        db.session.commit()
        yield app.test_client(), pc.id
        db.session.remove()
        db.drop_all()

def test_queue_command_dict_payload(client_app):
    client, pc_id = client_app
    cmd_payload = {"type": "vnc_start", "vnc_password": "secret_vnc_pass"}
    ClientService.queue_vnc_command(pc_id, cmd_payload)
    
    headers = {"X-Client-Key": "TM2026QWERTY-api-key"}
    res = client.post("/api/v1/public/client/vnc_poll", json={"ip_address": "192.168.1.101", "mac_address": "AA:BB:CC:DD:EE:01"}, headers=headers)
    assert res.status_code == 200
    data = res.get_json()
    assert data.get("command") == cmd_payload

def test_vnc_ready_endpoint(client_app):
    client, pc_id = client_app
    headers = {"X-Client-Key": "TM2026QWERTY-api-key"}
    res = client.post("/api/v1/public/client/vnc_ready", json={"ip_address": "192.168.1.101", "ready": True}, headers=headers)
    assert res.status_code == 200
    success, err = VNCClientProxyService.wait_vnc_ready(pc_id, timeout=0.5)
    assert success is True
    assert err is None

def test_vnc_ready_and_stopped_mac_fallback(client_app):
    """Test bahwa vnc_ready dan vnc_stopped berhasil mengenali PC via MAC jika IP Unknown."""
    client, pc_id = client_app
    headers = {"X-Client-Key": "TM2026QWERTY-api-key"}
    
    # Test vnc_ready via MAC
    res_ready = client.post("/api/v1/public/client/vnc_ready", json={
        "ip_address": "Unknown",
        "mac_address": "AA:BB:CC:DD:EE:01",
        "ready": True
    }, headers=headers)
    assert res_ready.status_code == 200
    assert res_ready.get_json()["success"] is True
    success, err = VNCClientProxyService.wait_vnc_ready(pc_id, timeout=0.5)
    assert success is True
    assert err is None

    # Test vnc_stopped via MAC
    res_stop = client.post("/api/v1/public/client/vnc_stopped", json={
        "ip_address": "Unknown",
        "mac_address": "AA:BB:CC:DD:EE:01"
    }, headers=headers)
    assert res_stop.status_code == 200
    assert res_stop.get_json()["success"] is True
    success, err = VNCClientProxyService.wait_vnc_ready(pc_id, timeout=0.5)
    assert success is False
    assert err is not None
