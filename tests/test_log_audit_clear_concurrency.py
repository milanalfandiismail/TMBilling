import threading

import pytest

from app import create_app
from app.models import db, Grup, PC, Paket, Sesi, Transaksi
from app.repositories.transaksi.transaksi_repository import TransaksiRepository
from app.services.report.log_audit_service import LogAuditService
from app.services.sesi.sesi_service import SesiService
from app.utils.timezone_utils import get_today_local_date


@pytest.fixture
def clear_race_app(tmp_path):
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path/'clear_race.db'}",
    })
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler", keterangan="Reguler", warna="#888888")
        db.session.add(grup)
        db.session.commit()
        paket = Paket(nama="Paket 1 Jam", durasi_menit=60, harga=12000,
                      grup_id=grup.id, aktif=True, kadaluarsa_hari=30)
        pc = PC(kode="PC01", nama="PC 01", grup_id=grup.id)
        db.session.add_all([paket, pc])
        db.session.commit()
        paket_id = paket.id
    yield {"app": app, "paket_id": paket_id}


def test_clear_date_serializes_with_guest_open(clear_race_app, monkeypatch):
    app = clear_race_app["app"]
    paket_id = clear_race_app["paket_id"]
    tanggal = get_today_local_date().isoformat()

    masuk_delete = threading.Event()
    lanjut_delete = threading.Event()
    original_delete = TransaksiRepository.delete_by_date

    def blocked_delete(tgl):
        masuk_delete.set()
        assert lanjut_delete.wait(5), "delete_by_date tidak pernah dilepas"
        return original_delete(tgl)

    monkeypatch.setattr(TransaksiRepository, "delete_by_date", staticmethod(blocked_delete))

    hasil = {}

    def jalankan_clear():
        with app.app_context():
            try:
                hasil["clear"] = LogAuditService.clear_transactions_by_date(tanggal, operator="kasir")
            except ValueError as e:
                hasil["clear"] = str(e)

    def buka_guest():
        with app.app_context():
            try:
                SesiService.buka_guest("PC01", paket_id, operator="kasir")
                hasil["open"] = "ok"
            except ValueError as e:
                hasil["open"] = str(e)

    clear_thread = threading.Thread(target=jalankan_clear)
    clear_thread.start()
    assert masuk_delete.wait(5), "cleanup tidak pernah masuk tahap hapus"

    open_thread = threading.Thread(target=buka_guest)
    open_thread.start()
    # Tanpa lock, buka_guest selesai (commit) saat cleanup masih tertahan di delete.
    open_thread.join(3)

    lanjut_delete.set()
    clear_thread.join(5)
    open_thread.join(5)

    with app.app_context():
        aktif = Sesi.query.filter_by(status="aktif").count()
        beli = Transaksi.query.filter_by(jenis="beli_paket_guest").count()
        if aktif:
            assert beli == 1, "sesi aktif kehilangan nota pembeliannya"
        else:
            assert beli == 0
