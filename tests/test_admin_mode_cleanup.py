from datetime import timedelta

import pytest

from app import create_app
from app.models import db, Grup, PC, Sesi, now_local
from app.services.cache.client_state_store import OnlineStatusStore
from app.services.sesi.sesi_service import SesiService


@pytest.fixture
def app_ctx(tmp_path):
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path/'admincleanup.db'}",
    })
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler", keterangan="Reguler", warna="#888888")
        db.session.add(grup)
        db.session.flush()
        pc = PC(kode="PC-1", ip_address="10.10.10.1", grup_id=grup.id, is_admin_mode=True)
        db.session.add(pc)
        db.session.flush()
        sesi = Sesi(tipe="admin", pc_id=pc.id, status="aktif", token_sesi="tok-admin-1")
        db.session.add(sesi)
        db.session.commit()
        yield pc, sesi
        db.session.remove()
        db.drop_all()


def test_cleanup_admin_menutup_sesi_admin(app_ctx):
    pc, sesi = app_ctx
    OnlineStatusStore.remove(pc.id)
    pc.last_activity = now_local() - timedelta(seconds=120)
    db.session.commit()

    SesiService.cleanup_inactive_admin_sessions()

    db.session.refresh(pc)
    db.session.refresh(sesi)
    assert pc.is_admin_mode is False
    assert sesi.status == "selesai"
    assert sesi.selesai_pada is not None
