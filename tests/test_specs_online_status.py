import pytest
from app import create_app, db
from app.models import Grup, PC
from app.services.cache.client_state_store import OnlineStatusStore


@pytest.fixture
def ctx():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    OnlineStatusStore.clear()
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler", keterangan="Reguler", warna="#888888")
        db.session.add(grup)
        db.session.commit()
        aktif = PC(kode="TM-1", nama="PC 1", ip_address="10.0.0.1", grup_id=grup.id, aktif=True)
        arsip = PC(kode="TM-2", nama="PC 2", ip_address="10.0.0.2", grup_id=grup.id, aktif=False)
        db.session.add_all([aktif, arsip])
        db.session.commit()
        yield app


def test_spesifikasi_memakai_status_heartbeat(ctx):
    resp = ctx.test_client().get("/spesifikasi")

    assert resp.status_code == 200
    body = resp.get_data(as_text=True)
    assert '"online": false' in body
    assert "TM-2" not in body
