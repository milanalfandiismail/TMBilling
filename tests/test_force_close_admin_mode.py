import pytest

from app import create_app, db
from app.models import Grup, PC, Sesi, now_local
from app.services.blackout.blackout_service import BlackoutService


@pytest.fixture
def app_ctx():
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "SECRET_KEY": "test-blackout-admin",
    })
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.flush()
        pc = PC(kode="PC-1", nama="PC-1", ip_address="10.1.0.1",
                mac_address="AA:BB:CC:DD:EE:01", grup_id=grup.id, aktif=True,
                is_admin_mode=True)
        db.session.add(pc)
        db.session.flush()
        sesi = Sesi(tipe="admin", pc_id=pc.id, durasi_beli_menit=60, total_bayar=0,
                    status="aktif", token_sesi="a" * 20, mulai_pada=now_local(),
                    waktu_mulai_sesi=now_local(), last_sync=now_local())
        db.session.add(sesi)
        db.session.commit()
        yield pc, sesi
        db.session.remove()
        db.drop_all()


def test_force_close_all_clears_pc_admin_mode(app_ctx):
    pc, sesi = app_ctx
    BlackoutService.force_all_and_detect(operator="admin")
    db.session.refresh(pc)
    db.session.refresh(sesi)
    assert pc.is_admin_mode is False
    assert sesi.status == "selesai"
