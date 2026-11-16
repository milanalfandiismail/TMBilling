import pytest
from sqlalchemy.exc import IntegrityError
from app import create_app, db
from app.models import Grup, Paket, PC
from app.services.sesi.sesi_service import SesiService


def test_flush_pc_bentrok_jadi_value_error(monkeypatch):
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
    })
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.commit()
        pc = PC(kode="PC-FLUSH", nama="PC Flush", grup_id=grup.id, aktif=True)
        paket = Paket(nama="Paket 1 Jam", durasi_menit=60, harga=5000,
                      grup_id=grup.id, aktif=True)
        db.session.add_all([pc, paket])
        db.session.commit()

        def gagal_flush():
            raise IntegrityError("INSERT", {}, Exception("UNIQUE constraint failed: sesi.pc_id"))

        monkeypatch.setattr(db.session, "flush", gagal_flush)

        with pytest.raises(ValueError, match="PC sedang dipakai"):
            SesiService.buka_guest("PC-FLUSH", paket.id, nama_guest="Guest")

        db.session.rollback()
