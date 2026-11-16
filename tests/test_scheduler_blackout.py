from datetime import timedelta
from app import create_app
from app.models import db, Grup, PC, Paket, Sesi, now_local
from app.utils.scheduler_tasks import run_cleanup_expired


def test_scheduler_menandai_sesi_offline_kedaluwarsa():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.commit()
        pc = PC(kode="OFF-1", nama="Off", grup_id=grup.id)
        paket = Paket(nama="1 Jam", durasi_menit=60, harga=5000, grup_id=grup.id, aktif=True)
        db.session.add_all([pc, paket])
        db.session.commit()

        sesi = Sesi(
            tipe="guest", nama_guest="Mati", pc_id=pc.id, paket_id=paket.id,
            durasi_beli_menit=60, total_bayar=5000, status="aktif",
            mulai_pada=now_local() - timedelta(hours=3),
            waktu_mulai_sesi=now_local() - timedelta(hours=3),
            last_sync=now_local() - timedelta(hours=2),
            token_sesi="o" * 64,
        )
        db.session.add(sesi)
        db.session.commit()
        sesi_id = sesi.id

        run_cleanup_expired(app)

        db.session.remove()
        saved = db.session.get(Sesi, sesi_id)
        assert saved.status == "selesai"
        assert saved.is_blackout_suspect is True
