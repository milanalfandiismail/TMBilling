from datetime import datetime

import pytest

from app import create_app, db
from app.models import Grup, MaintenanceTicket, PC, Sesi
from app.repositories import SesiRepository


@pytest.fixture
def ctx():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler", keterangan="Reguler", warna="#888888")
        db.session.add(grup)
        db.session.commit()
        pc = PC(kode="PC-01", nama="PC 01", grup_id=grup.id, aktif=True)
        db.session.add(pc)
        db.session.commit()
        yield app, pc.id


def test_tanggal_tiket_maintenance_tidak_masuk_filter(ctx):
    app, pc_id = ctx
    with app.app_context():
        db.session.add(MaintenanceTicket(
            pc_id=pc_id, reporter="kasir", kategori="HARDWARE",
            judul="Ganti RAM", resolved_at=datetime(2026, 2, 2, 10, 0),
        ))
        db.session.add(Sesi(tipe="guest", mulai_pada=datetime(2026, 3, 3, 10, 0), status="selesai"))
        db.session.commit()

        tanggal = SesiRepository.get_distinct_tanggal()

        assert "2026-03-03" in tanggal
        assert "2026-02-02" not in tanggal
