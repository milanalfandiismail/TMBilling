import pytest
from app import create_app, db
from app.models import Grup, PC
from app.services.maintenance.maintenance_service import MaintenanceService


@pytest.fixture
def ctx():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler", keterangan="Reguler", warna="#888888")
        db.session.add(grup)
        db.session.commit()
        pc = PC(kode="PC-01", nama="PC 01", ip_address="10.0.0.1", grup_id=grup.id, aktif=True)
        db.session.add(pc)
        db.session.commit()
        yield pc


def test_tiket_kritis_dan_selesai_mengubah_status_pc(ctx):
    pc = ctx

    ticket = MaintenanceService.create_ticket(
        pc_id=pc.id, reporter="kasir", kategori="HARDWARE",
        prioritas="KRITIS", judul="Motherboard mati", deskripsi="Tidak menyala"
    )
    db.session.refresh(pc)
    assert pc.aktif is False

    MaintenanceService.update_status(ticket.id, "SELESAI", resolved_by="teknisi", biaya=50000)
    db.session.refresh(pc)
    assert pc.aktif is True


def test_selesaikan_tiket_ringan_tidak_menghidupkan_pc_bila_masih_ada_kritis_terbuka(ctx):
    pc = ctx

    kritis = MaintenanceService.create_ticket(
        pc_id=pc.id, reporter="kasir", kategori="HARDWARE",
        prioritas="KRITIS", judul="Motherboard mati", deskripsi="Tidak menyala"
    )
    ringan = MaintenanceService.create_ticket(
        pc_id=pc.id, reporter="kasir", kategori="LAINNYA",
        prioritas="RENDAH", judul="Mouse macet", deskripsi="Klik kiri keras"
    )
    db.session.refresh(pc)
    assert pc.aktif is False

    MaintenanceService.update_status(ringan.id, "SELESAI", resolved_by="teknisi")
    db.session.refresh(pc)
    assert pc.aktif is False

    MaintenanceService.update_status(kritis.id, "SELESAI", resolved_by="teknisi")
    db.session.refresh(pc)
    assert pc.aktif is True
