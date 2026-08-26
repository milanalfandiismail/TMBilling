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
    with client.session_transaction() as sess:
        sess["kasir_role"] = "kasir"  # Non-admin
        
    res = client.post(f"/api/v1/kasir/monitor/vnc_client/{pc_id}/start")
    assert res.status_code == 403

def test_vnc_status_endpoint(admin_client):
    client, pc_id = admin_client
    res = client.get(f"/api/v1/kasir/monitor/vnc_client/{pc_id}/status")
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["active"] is False
