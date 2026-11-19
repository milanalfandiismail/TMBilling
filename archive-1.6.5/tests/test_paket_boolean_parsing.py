import pytest
from app import create_app, db
from app.models import Paket, Grup
from app.services.paket.paket_service import PaketService


@pytest.fixture
def ctx():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler", keterangan="Reguler", warna="#888888")
        db.session.add(grup)
        db.session.commit()
        paket = Paket(nama="Paket 1 Jam", durasi_menit=60, harga=10000, aktif=True, grup_id=grup.id)
        db.session.add(paket)
        db.session.commit()
        yield paket


def test_aktif_string_false_menjadi_false(ctx):
    paket = ctx

    PaketService.update(paket.id, {"aktif": "false"})

    db.session.refresh(paket)
    assert paket.aktif is False
