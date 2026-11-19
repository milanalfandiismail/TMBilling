import pytest
from app import create_app, db
from app.models import Grup, Paket, PC
from app.services.sesi import sesi_service
from app.services.sesi.sesi_service import SesiService


def test_batch_gagal_tidak_menulis_log_sukses(monkeypatch):
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
    })
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.commit()
        pc = PC(kode="PC-LOG", nama="PC Log", grup_id=grup.id, aktif=True)
        paket = Paket(nama="Paket 1 Jam", durasi_menit=60, harga=5000,
                      grup_id=grup.id, aktif=True)
        db.session.add_all([pc, paket])
        db.session.commit()

        sesi = SesiService.buka_guest("PC-LOG", paket.id, nama_guest="Guest Log")
        logs = []
        monkeypatch.setattr(sesi_service, "write_log",
                            lambda action, message, **kwargs: logs.append((action, message)))

        with pytest.raises(ValueError):
            SesiService.tambah_waktu_sesi_batch(
                [(sesi.id, paket, 1), (sesi.id, None, 1)],
                operator="kasir_log",
            )

        assert logs == []
