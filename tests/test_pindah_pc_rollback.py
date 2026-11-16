import pytest

from app import create_app
from app.models import db, Grup, PC, Sesi
from app.services.sesi.sesi_service import SesiService


@pytest.fixture
def ctx(tmp_path):
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///" + str(tmp_path / "pindah.db"),
    })
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler", keterangan="Reguler", warna="#888888")
        db.session.add(grup)
        db.session.commit()
        pc1 = PC(kode="PC01", nama="PC 01", grup_id=grup.id)
        pc2 = PC(kode="PC02", nama="PC 02", grup_id=grup.id)
        db.session.add_all([pc1, pc2])
        db.session.commit()
        sesi = Sesi(tipe="guest", nama_guest="Uji", pc_id=pc1.id,
                    durasi_beli_menit=60, total_bayar=10000, status="aktif")
        db.session.add(sesi)
        db.session.commit()
        yield {"app": app, "sesi_id": sesi.id}


def test_commit_gagal_tidak_meninggalkan_sesi_baru(ctx, monkeypatch):
    with ctx["app"].app_context():
        original = db.session.commit

        def boom():
            raise RuntimeError("disk penuh")

        monkeypatch.setattr(db.session, "commit", boom)
        with pytest.raises(ValueError, match="Gagal memindahkan sesi"):
            SesiService.pindah_pc(ctx["sesi_id"], "PC02", operator="kasir")

        monkeypatch.setattr(db.session, "commit", original)
        db.session.rollback()
        assert db.session.get(Sesi, ctx["sesi_id"]).status == "aktif"
        assert Sesi.query.filter_by(status="aktif").count() == 1
