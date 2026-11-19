from app import create_app, db
from app.models import Grup, PC, Sesi, Transaksi
from app.services.client.client_service import ClientService
from app.services.pc.pc_service import PCService


def test_reset_admin_closes_session_and_queues_by_pc_id(monkeypatch):
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
                      "SECRET_KEY": "test-reset-admin"})
    queued = []
    monkeypatch.setattr(ClientService, "queue_command", staticmethod(lambda pc_id, cmd: queued.append((pc_id, cmd))))
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.flush()
        pc = PC(kode="PC-01", nama="PC-01", ip_address="10.0.0.1",
                mac_address="AA:BB:CC:DD:EE:01", grup_id=grup.id, aktif=True, is_admin_mode=True)
        db.session.add(pc)
        db.session.flush()
        sesi = Sesi(pc_id=pc.id, tipe="admin", status="aktif", durasi_beli_menit=0)
        db.session.add(sesi)
        db.session.commit()

        PCService.reset_admin_mode(pc.id, operator="admin")

        assert db.session.get(PC, pc.id).is_admin_mode is False
        db.session.refresh(sesi)
        assert sesi.status == "selesai"
        assert Transaksi.query.filter_by(sesi_id=sesi.id, jenis="tutup_sesi").count() == 1
        assert queued == [(pc.id, "lock")]
