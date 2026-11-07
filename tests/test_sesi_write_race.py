import threading, time
import pytest
from app import create_app
from app.models import db, Grup, PC, Paket, Sesi
from app.services.sesi.sesi_service import SesiService
from app.repositories.sesi.sesi_repository import SesiRepository


@pytest.fixture
def ctx(tmp_path):
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path/'race.db'}",
    })
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler", keterangan="Reguler", warna="#888888")
        db.session.add(grup); db.session.commit()
        paket = Paket(nama="Paket 1 Jam", durasi_menit=60, harga=12000,
                      grup_id=grup.id, aktif=True, kadaluarsa_hari=30)
        pc = PC(kode="PC01", nama="PC 01", grup_id=grup.id)
        db.session.add_all([paket, pc]); db.session.commit()
        sesi = Sesi(tipe="guest", nama_guest="Uji", pc_id=pc.id, paket_id=paket.id,
                    durasi_beli_menit=60, total_bayar=12000, status="aktif")
        db.session.add(sesi); db.session.commit()
        yield {"app": app, "paket_id": paket.id, "sesi_id": sesi.id}


def test_dua_tambah_waktu_paralel_tidak_hilang(ctx, monkeypatch):
    original = SesiRepository.get_aktif_by_id
    def slow(sesi_id):
        s = original(sesi_id)
        time.sleep(0.15)
        return s
    monkeypatch.setattr(SesiRepository, "get_aktif_by_id", staticmethod(slow))

    errors = []
    def run():
        with ctx["app"].app_context():
            try:
                paket = db.session.get(Paket, ctx["paket_id"])
                SesiService.tambah_waktu_sesi(ctx["sesi_id"], paket, operator="kasir")
            except Exception as e:  # pragma: no cover
                errors.append(e)

    threads = [threading.Thread(target=run) for _ in range(2)]
    [t.start() for t in threads]; [t.join() for t in threads]

    assert errors == []
    with ctx["app"].app_context():
        sesi = db.session.get(Sesi, ctx["sesi_id"])
        assert sesi.durasi_beli_menit == 180
        assert sesi.total_bayar == 36000
