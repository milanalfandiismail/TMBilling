from app import create_app
from app.models import db, Grup, PC
from app.services.maintenance.maintenance_service import MaintenanceService


def _app():
    app = create_app({"TESTING": True, "WTF_CSRF_ENABLED": False,
                      "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        grup = Grup(nama="reguler", keterangan="Reguler", warna="#888888")
        db.session.add(grup)
        db.session.commit()
        pc = PC(kode="PC-01", nama="PC 01", ip_address="10.0.0.1",
                grup_id=grup.id, aktif=True)
        db.session.add(pc)
        db.session.commit()
        return app, pc.id


def _ticket(pc_id):
    return MaintenanceService.create_ticket(
        pc_id=pc_id, reporter="kasir", kategori="HARDWARE", prioritas="KRITIS",
        judul="PC mati total", deskripsi="Tidak menyala")


def test_hapus_tiket_kritis_menghidupkan_pc():
    app, pc_id = _app()
    with app.app_context():
        ticket = _ticket(pc_id)
        assert PC.query.get(pc_id).aktif is False
        MaintenanceService.delete_ticket(ticket.id)
        assert PC.query.get(pc_id).aktif is True


def test_hapus_tiket_kritis_tidak_hidupkan_pc_bila_ada_tiket_lain():
    app, pc_id = _app()
    with app.app_context():
        pertama = _ticket(pc_id)
        _ticket(pc_id)
        MaintenanceService.delete_ticket(pertama.id)
        assert PC.query.get(pc_id).aktif is False
