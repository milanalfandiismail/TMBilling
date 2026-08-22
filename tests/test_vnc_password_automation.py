# tests/test_vnc_password_automation.py
import pytest
from app import create_app, db
from app.models import User
from app.services.settings.settings_service import SettingsService

@pytest.fixture
def client_with_admin():
    app = create_app()
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
            admin = User.query.filter_by(username="admin").first()
            if not admin:
                admin = User(username="admin", nama_lengkap="Admin", role="admin", aktif=True)
                admin.set_password("admin123")
                db.session.add(admin)
                db.session.commit()
            
            with client.session_transaction() as sess:
                sess["kasir_id"] = admin.id
                sess["kasir_username"] = admin.username
                sess["kasir_role"] = "admin"
                sess["kasir_nama"] = admin.nama_lengkap
            yield client
            db.session.remove()

def test_vnc_start_returns_configured_password(client_with_admin):
    # Set VNC password in database
    SettingsService.set("vnc_password", "secretVNCpwd123")
    
    # Fire VNC start request
    res = client_with_admin.post("/api/v1/kasir/vnc/start")
    
    # It can return 200 (if websockify starts or runs) or 400 (if websockify fails, e.g. TightVNC server not on 5900)
    # But in either case, the json payload should contain the configured password if the endpoint logic succeeds
    print("STATUS CODE:", res.status_code)
    print("DATA:", res.data)
    assert res.status_code in [200, 400, 403, 302]
    data = res.get_json()
    assert data is not None
    assert "vnc_password" in data
    assert data["vnc_password"] == "secretVNCpwd123"
