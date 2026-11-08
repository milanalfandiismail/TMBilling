from app import create_app, db
from app.models import Grup, PC, Sesi, now_local
from app.services.client.client_service import ClientService
from app.services.sesi.sesi_service import SesiService


def test_sync_error_tidak_menutup_sesi(monkeypatch):
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
    })
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.commit()
        pc = PC(kode="PC-SYNC", nama="PC Sync", grup_id=grup.id,
                ip_address="10.0.0.40", mac_address="AA:BB:CC:DD:EE:40", aktif=True)
        db.session.add(pc)
        db.session.commit()
        sesi = Sesi(
            tipe="guest", nama_guest="Guest Sync", pc_id=pc.id,
            status="aktif", waktu_mulai_sesi=now_local(),
            durasi_beli_menit=60, total_bayar=5000,
        )
        db.session.add(sesi)
        db.session.commit()

        ditutup = []
        monkeypatch.setattr(SesiService, "sync_waktu_member",
                            lambda sesi: (_ for _ in ()).throw(RuntimeError("db lock")))
        monkeypatch.setattr(SesiService, "tutup_sesi",
                            lambda *args, **kwargs: ditutup.append(args[0]))

        hasil = ClientService.get_status("10.0.0.40", "AA:BB:CC:DD:EE:40")

        assert hasil["status"] == "error"
        assert ditutup == []
