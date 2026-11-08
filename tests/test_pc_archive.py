import pytest
from app import create_app
from app.models import db, Grup, PC, Sesi
from app.services.pc.pc_service import PCService


@pytest.fixture
def app():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.commit()
        yield app
        db.session.remove()
        db.drop_all()


def test_pc_dengan_riwayat_diarsipkan_bukan_dihapus(app):
    with app.app_context():
        grup = Grup.query.first()
        pc = PC(kode="ARSIP-1", nama="Arsip", grup_id=grup.id, aktif=True)
        db.session.add(pc)
        db.session.commit()
        sesi = Sesi(tipe="guest", nama_guest="Lama", pc_id=pc.id, status="selesai")
        db.session.add(sesi)
        db.session.commit()
        pc_id, sesi_id = pc.id, sesi.id

        PCService.delete(pc_id, operator="admin")

        assert db.session.get(PC, pc_id).aktif is False
        assert db.session.get(Sesi, sesi_id).pc_id == pc_id


def test_kode_pc_arsip_bisa_didaftarkan_lagi(app):
    with app.app_context():
        grup = Grup.query.first()
        pc = PC(kode="ARSIP-2", nama="Lama", grup_id=grup.id, aktif=False)
        db.session.add(pc)
        db.session.commit()
        pc_id = pc.id

        hasil = PCService.create({"kode": "ARSIP-2", "nama": "Baru", "grup": "reguler"})

        assert hasil.id == pc_id
        assert hasil.aktif is True
        assert hasil.nama == "Baru"
