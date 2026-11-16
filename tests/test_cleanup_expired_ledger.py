import pytest
from app import create_app, db
from app.models import Grup, PC, Sesi
from app.services.sesi.sesi_service import SesiService


@pytest.fixture
def app_ctx():
    app = create_app({"TESTING": True, "WTF_CSRF_ENABLED": False,
                      "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


def test_cleanup_expired_tidak_menelan_kegagalan_nota(app_ctx, monkeypatch):
    grup = Grup(nama="reguler")
    db.session.add(grup)
    db.session.commit()
    pc = PC(kode="PC01", nama="PC 01", ip_address="10.0.0.1", grup_id=grup.id)
    db.session.add(pc)
    db.session.commit()
    sesi = Sesi(tipe="guest", pc_id=pc.id, nama_guest="Tamu", durasi_beli_menit=1,
                total_bayar=5000, status="aktif")
    db.session.add(sesi)
    db.session.commit()
    sesi_id = sesi.id
    monkeypatch.setattr(Sesi, "sisa_menit", lambda self: 0)

    class TransaksiGagal:
        def __init__(self, *args, **kwargs):
            raise RuntimeError("nota gagal")

    monkeypatch.setattr("app.services.sesi.sesi_service.Transaksi", TransaksiGagal)
    with pytest.raises(RuntimeError, match="nota gagal"):
        SesiService.cleanup_expired()
    db.session.rollback()
    assert db.session.get(Sesi, sesi_id).status == "aktif"
