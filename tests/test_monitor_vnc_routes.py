import pytest
from app import create_app, db
from app.models import PC, Grup, User
from app.services.vnc.vnc_service import VNCClientProxyService

@pytest.fixture
def admin_client():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["WTF_CSRF_ENABLED"] = False
    with app.app_context():
        db.create_all()
        
        grup = Grup.query.filter_by(nama="vip").first()
        if not grup:
            grup = Grup(nama="vip")
            db.session.add(grup)
            db.session.commit()
            
        pc = PC.query.filter_by(ip_address="192.168.1.102").first()
        if not pc:
            pc = PC(kode="PC-02", ip_address="192.168.1.102", mac_address="AA:BB:CC:DD:EE:02", grup_id=grup.id)
            db.session.add(pc)
            
        admin = User.query.filter_by(username="admin").first()
        if not admin:
            admin = User(username="admin", role="admin")
            admin.set_password("admin123")
            db.session.add(admin)
            
        db.session.commit()
        
        client = app.test_client()
        with client.session_transaction() as sess:
            sess["kasir_id"] = admin.id
            sess["kasir_username"] = "admin"
            sess["kasir_role"] = "admin"
            
        yield client, pc.id
        db.session.remove()
        db.drop_all()

def test_vnc_start_non_admin_forbidden(admin_client):
    client, pc_id = admin_client
    with client.application.app_context():
        kasir = User.query.filter_by(username="kasir_vnc").first()
        if not kasir:
            kasir = User(username="kasir_vnc", role="kasir", aktif=True)
            kasir.set_password("kasir123")
            db.session.add(kasir)
            db.session.commit()
        kasir_id = kasir.id

    with client.session_transaction() as sess:
        sess["kasir_id"] = kasir_id
        sess["kasir_username"] = "kasir_vnc"
        sess["kasir_role"] = "kasir"

    res = client.post(f"/api/v1/kasir/monitor/vnc_client/{pc_id}/start")
    assert res.status_code == 403

def test_vnc_status_endpoint(admin_client):
    client, pc_id = admin_client
    res = client.get(f"/api/v1/kasir/monitor/vnc_client/{pc_id}/status")
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["active"] is False

def test_kasir_monitor_all_endpoint(admin_client):
    client, pc_id = admin_client
    res = client.get("/api/v1/kasir/monitor/all")
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert isinstance(data["data"], list)

def test_kasir_monitor_processes_endpoint(admin_client):
    client, pc_id = admin_client
    res = client.get(f"/api/v1/kasir/monitor/processes/{pc_id}")
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert "data" in data
    assert "last_updated_ts" in data


def test_kasir_trigger_refresh_processes_endpoint(admin_client):
    client, pc_id = admin_client
    res = client.post(f"/api/v1/kasir/monitor/processes/{pc_id}/trigger")
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert "berhasil dikirim" in data["message"]


def test_public_monitor_processes_fallback_ts(admin_client):
    """Endpoint proses kasir tidak crash saat telemetry RAM kosong."""
    client, pc_id = admin_client
    from app.services.cache.telemetry_store import ProcessMemoryStore
    # Bersihkan memori telemetry PC untuk memicu fallback timestamp database
    ProcessMemoryStore.remove(pc_id)

    res = client.get(f"/api/v1/kasir/monitor/processes/{pc_id}")
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert isinstance(data["last_updated_ts"], int)




def test_single_pc_hardware_returns_one_row(admin_client):
    from app.models import db, HardwareMonitor
    client, pc_id = admin_client
    db.session.add(HardwareMonitor(pc_id=pc_id, cpu_name="i7", gpu_name="RTX"))
    db.session.commit()

    res = client.get(f"/api/v1/kasir/monitor/hardware/{pc_id}")
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["pc_kode"] == "PC-02"
    assert data["cpu_name"] == "i7"
    assert "hardware_baseline" in data


def test_single_pc_hardware_404_when_missing(admin_client):
    client, _ = admin_client
    res = client.get("/api/v1/kasir/monitor/hardware/999999")
    assert res.status_code == 404
