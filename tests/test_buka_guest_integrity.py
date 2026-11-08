import pytest
from sqlalchemy.exc import IntegrityError
from app import create_app
from app.models import db, Grup, PC, Paket
from app.services import SesiService


def test_integrity_error_bukan_pc_diteruskan(monkeypatch):
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.commit()
        pc = PC(kode="G-1", nama="G", grup_id=grup.id)
        paket = Paket(nama="1 Jam", durasi_menit=60, harga=5000, grup_id=grup.id, aktif=True)
        db.session.add_all([pc, paket])
        db.session.commit()

        def gagal():
            raise IntegrityError("INSERT", {}, Exception("UNIQUE constraint failed: transaksi.no_nota"))

        monkeypatch.setattr(db.session, "commit", gagal)

        with pytest.raises(IntegrityError):
            SesiService.buka_guest("G-1", paket.id, nama_guest="Guest")
