import pytest

from app import create_app
from app.models import db, Grup, PC
from app.services.hardware.hardware_service import HardwareService


@pytest.fixture
def app_ctx(tmp_path):
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path/'hw.db'}",
    })
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.flush()
        pc_a = PC(kode="PC-A", ip_address="10.0.0.1", mac_address="AA:BB:CC:00:00:01", grup_id=grup.id)
        pc_b = PC(kode="PC-B", ip_address="10.0.0.2", mac_address="AA:BB:CC:00:00:02", grup_id=grup.id)
        db.session.add_all([pc_a, pc_b])
        db.session.commit()
        yield pc_a, pc_b
        db.session.remove()
        db.drop_all()


def test_ip_body_tidak_bisa_mengganti_pc(app_ctx):
    pc_a, pc_b = app_ctx
    result = HardwareService.process_hardware_metric(
        pc_a.ip_address,
        {"IpAddress": pc_b.ip_address, "MacAddress": pc_a.mac_address, "CpuUsage": 5.0},
    )
    assert result["id"] == pc_a.id
    assert result["kode"] == pc_a.kode
