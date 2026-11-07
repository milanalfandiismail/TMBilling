import uuid
import pytest
from app import create_app
from app.models import db, Grup, PC, Paket, Sesi, Transaksi
from app.services.sesi.sesi_service import SesiService
from app.services.paket.paket_service import PaketService
from app.services.report.report_service import ReportService


@pytest.fixture
def ctx():
    app = create_app({"TESTING": True, "WTF_CSRF_ENABLED": False,
                      "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
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
        yield {"paket": paket, "pc": pc, "sesi": sesi}
        db.session.remove(); db.drop_all()


def test_tambah_waktu_paket_none_menghasilkan_value_error(ctx):
    with pytest.raises(ValueError, match="Paket tidak ditemukan"):
        SesiService.tambah_waktu_sesi(ctx["sesi"].id, None, operator="kasir")


def test_hapus_paket_none_menghasilkan_404(ctx):
    from werkzeug.exceptions import NotFound
    with pytest.raises(NotFound):
        PaketService.delete(999999, operator="kasir")


def test_laporan_dan_history_tetap_aman_setelah_paket_dihapus(ctx):
    # transaksi lama menunjuk paket, lalu paket dihapus permanen (foreign_keys OFF)
    trx = Transaksi(sesi_id=ctx["sesi"].id, paket_id=ctx["paket"].id, jenis="beli_paket_guest",
                    jumlah=12000, menit=60, keterangan="Beli paket 'Paket 1 Jam' x1",
                    no_nota=f"TM-{uuid.uuid4().hex[:8]}", metode_pembayaran="Tunai")
    db.session.add(trx); db.session.commit()
    db.session.delete(ctx["paket"]); db.session.commit()

    rows = ReportService._format_history_struk([db.session.get(Transaksi, trx.id)])
    assert rows[0]["paket_nama"]  # tidak kosong, tidak crash


def test_batch_paket_kedua_invalid_tidak_menagih_sesi():
    from app.models import User
    app = create_app({"TESTING": True, "WTF_CSRF_ENABLED": False,
                      "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    client = app.test_client()
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler", keterangan="Reguler", warna="#888888")
        admin = User(username="admin_uji", password_hash="x", role="admin", aktif=True)
        db.session.add_all([grup, admin]); db.session.commit()
        valid = Paket(nama="Valid", durasi_menit=60, harga=12000, grup_id=grup.id, aktif=True)
        pc = PC(kode="PC09", nama="PC 09", grup_id=grup.id)
        db.session.add_all([valid, pc]); db.session.commit()
        sesi = Sesi(tipe="guest", nama_guest="Batch", pc_id=pc.id, paket_id=valid.id,
                    durasi_beli_menit=60, total_bayar=12000, status="aktif")
        db.session.add(sesi); db.session.commit()
        sesi_id, valid_id, admin_id = sesi.id, valid.id, admin.id

    with client.session_transaction() as s:
        s["kasir_id"] = admin_id; s["kasir_username"] = "admin_uji"; s["kasir_role"] = "admin"

    res = client.post("/api/v1/kasir/sesi/tambah-waktu-batch", json={
        "sesi_ids": [sesi_id],
        "selections": [{"paket_id": valid_id, "qty": 1}, {"paket_id": 999999, "qty": 1}],
    })
    assert res.status_code == 400  # seluruh seleksi divalidasi sebelum ditagih

    with app.app_context():
        sesi = db.session.get(Sesi, sesi_id)
        assert sesi.durasi_beli_menit == 60   # tidak tertagih sebagian
        assert Transaksi.query.filter_by(sesi_id=sesi_id, jenis="tambah_waktu_guest").count() == 0
