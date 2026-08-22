# tests/test_admin_identity_and_emergency.py
import pytest
from app import create_app, db
from app.models import PC, User, Sesi, Grup
from app.services.client.client_service import ClientService
from app.services.dashboard.dashboard_service import DashboardService

@pytest.fixture
def app():
    app = create_app()
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

def test_admin_login_returns_real_database_name(app, client):
    with app.app_context():
        grup = Grup(nama="reguler", warna="#888888")
        db.session.add(grup)
        db.session.commit()

        pc = PC(kode="PC-99", ip_address="192.168.1.99", mac_address="AA:BB:CC:DD:EE:99", grup_id=grup.id, aktif=True)
        admin = User(username="milan_admin", nama_lengkap="Milan Alfandi", role="admin", aktif=True)
        admin.set_password("password123")
        db.session.add_all([pc, admin])
        db.session.commit()

        res = ClientService.admin_login("192.168.1.99", "AA:BB:CC:DD:EE:99", "milan_admin", "password123")
        assert res["success"] is True
        assert "user" in res
        assert res["user"]["nama_lengkap"] == "Milan Alfandi"
        assert res["user"]["username"] == "milan_admin"
        assert res["user"]["role"] == "admin"

        # Verifikasi data sesi admin di dashboard
        data = DashboardService.get_pc_list()
        pc_item = next(p for p in data["pc_list"] if p["kode"] == "PC-99")
        assert pc_item["is_admin"] is True
        assert pc_item["sesi_detail"]["member_nama"] == "Milan Alfandi"

def test_kasir_role_cannot_perform_admin_login(app, client):
    with app.app_context():
        grup = Grup(nama="reguler", warna="#888888")
        db.session.add(grup)
        db.session.commit()

        pc = PC(kode="PC-98", ip_address="192.168.1.98", mac_address="AA:BB:CC:DD:EE:98", grup_id=grup.id, aktif=True)
        kasir = User(username="kasir_user", nama_lengkap="Staff Kasir", role="kasir", aktif=True)
        kasir.set_password("password123")
        db.session.add_all([pc, kasir])
        db.session.commit()

        with pytest.raises(ValueError, match="Invalid admin credentials"):
            ClientService.admin_login("192.168.1.98", "AA:BB:CC:DD:EE:98", "kasir_user", "password123")

def test_emergency_login_sets_system_identity(app, client):
    with app.app_context():
        grup = Grup(nama="reguler", warna="#888888")
        db.session.add(grup)
        db.session.commit()

        pc = PC(kode="PC-97", ip_address="192.168.1.97", mac_address="AA:BB:CC:DD:EE:97", grup_id=grup.id, aktif=True)
        db.session.add(pc)
        db.session.commit()

        res = ClientService.emergency_login("192.168.1.97", "AA:BB:CC:DD:EE:97")
        assert res["success"] is True

        data = DashboardService.get_pc_list()
        pc_item = next(p for p in data["pc_list"] if p["kode"] == "PC-97")
        assert pc_item["is_admin"] is True
        assert pc_item["sesi_detail"]["member_nama"] == "SYSTEM"
