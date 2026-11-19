from app import create_app, db
from app.models import Grup, PC
from app.services.pc.pc_service import PCService


def test_batch_hanya_pc_arsip_tetap_tersimpan():
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
    })
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.commit()
        pc = PC(kode="PC-1", nama="PC Arsip", ip_address="10.0.0.30",
                grup_id=grup.id, aktif=False)
        db.session.add(pc)
        db.session.commit()

        PCService.create_batch({
            "prefix": "PC",
            "start_num": 1,
            "end_num": 1,
            "ip_start": "10.0.0.30",
            "ip_end": "10.0.0.30",
            "grup": "reguler",
        })

        db.session.rollback()
        db.session.expire_all()
        saved = PC.query.filter_by(kode="PC-1").first()
        assert saved is not None
        assert saved.aktif is True
