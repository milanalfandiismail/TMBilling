import pytest
from app import create_app, db
from app.models import PC, Grup
from app.services.client.client_service import ClientService


@pytest.fixture
def app_client():
    app = create_app()
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False
    app.config["CLIENT_API_KEY"] = "test-client-key"

    with app.app_context():
        grup = Grup.query.filter_by(nama="test_emerg_grup").first()
        if not grup:
            grup = Grup(nama="test_emerg_grup", warna="#112233")
            db.session.add(grup)
            db.session.commit()

        pc = PC.query.filter_by(kode="PC-EMERG").first()
        if not pc:
            pc = PC(
                kode="PC-EMERG",
                ip_address="192.168.1.95",
                mac_address="AA:BB:CC:DD:EE:95",
                grup_id=grup.id,
                aktif=True,
            )
            db.session.add(pc)
            db.session.commit()

    with app.test_client() as client:
        yield app, client

    with app.app_context():
        pc = PC.query.filter_by(kode="PC-EMERG").first()
        if pc:
            db.session.delete(pc)
        grup = Grup.query.filter_by(nama="test_emerg_grup").first()
        if grup:
            db.session.delete(grup)
        db.session.commit()


def test_emergency_login_rejects_socket_ip_mismatch(app_client):
    app, client = app_client

    # Penyerang dari 192.168.1.88 mencoba membuka PC-EMERG (192.168.1.95)
    response = client.post(
        "/api/v1/public/client/emergency-login",
        json={
            "ip_address": "192.168.1.95",
            "mac_address": "AA:BB:CC:DD:EE:95",
            "username": "ATTACKER",
        },
        headers={"X-Client-Key": "test-client-key"},
        environ_base={"REMOTE_ADDR": "192.168.1.88"},
    )

    assert response.status_code == 403
    data = response.get_json()
    assert data["success"] is False
    assert "IP" in data["error"] or "soket" in data["error"].lower() or "forbidden" in data["error"].lower()


def test_emergency_login_succeeds_when_socket_ip_matches(app_client):
    app, client = app_client

    response = client.post(
        "/api/v1/public/client/emergency-login",
        json={
            "ip_address": "192.168.1.95",
            "mac_address": "AA:BB:CC:DD:EE:95",
            "username": "SYSTEM",
        },
        headers={"X-Client-Key": "test-client-key"},
        environ_base={"REMOTE_ADDR": "192.168.1.95"},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["success"] is True


def test_emergency_login_rejects_mac_mismatch(app_client):
    app, client = app_client

    response = client.post(
        "/api/v1/public/client/emergency-login",
        json={
            "ip_address": "192.168.1.95",
            "mac_address": "FF:FF:FF:FF:FF:FF",
            "username": "SYSTEM",
        },
        headers={"X-Client-Key": "test-client-key"},
        environ_base={"REMOTE_ADDR": "192.168.1.95"},
    )

    assert response.status_code == 400
    data = response.get_json()
    assert data["success"] is False
    assert "MAC" in data["error"]
