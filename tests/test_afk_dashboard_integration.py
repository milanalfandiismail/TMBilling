# tests/test_afk_dashboard_integration.py
import pytest
from app import create_app, db
from app.models import PC, Sesi, User, Grup, now_local
from app.services.dashboard.dashboard_service import DashboardService

@pytest.fixture
def app_context():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.create_all()
        grup = Grup.query.filter_by(nama="reguler").first()
        if not grup:
            grup = Grup(nama="reguler", warna="#888888")
            db.session.add(grup)
            db.session.commit()
        yield app
        db.session.remove()
        db.drop_all()

def test_dashboard_service_delivers_afk_state(app_context):
    grup = Grup.query.filter_by(nama="reguler").first()
    pc = PC(kode="PC03", nama="PC 03", ip_address="192.168.1.103", grup_id=grup.id)
    db.session.add(pc)
    db.session.commit()

    sesi = Sesi(tipe="guest", pc_id=pc.id, nama_guest="Rudi", durasi_beli_menit=60, status="aktif", is_afk=True)
    db.session.add(sesi)
    db.session.commit()

    data = DashboardService.get_pc_list()
    pc_found = next(p for p in data["pc_list"] if p["kode"] == "PC03")
    assert pc_found["is_afk"] is True
    assert pc_found["sesi_detail"]["is_afk"] is True
