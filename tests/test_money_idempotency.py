import pytest

from app import create_app
from app.models import db, Grup, MenuItem, Paket, PC, Sesi, Transaksi, User
from app.services import idempotency
from app.services.menu.menu_service import MenuService
from app.services.sesi.sesi_service import SesiService


@pytest.fixture(autouse=True)
def bersihkan_kunci():
    idempotency.reset()
    yield
    idempotency.reset()


@pytest.fixture
def ctx(tmp_path):
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///" + str(tmp_path / "idem.db"),
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
        sesi = Sesi(tipe="guest", nama_guest="Uji", pc_id=pc.id, paket_id=paket.id,
                    durasi_beli_menit=60, total_bayar=12000, status="aktif")
        db.session.add(sesi)
        db.session.commit()
        yield {"app": app, "paket_id": paket.id, "sesi_id": sesi.id}


def test_tambah_waktu_duplikat_ditolak(ctx):
    with ctx["app"].app_context():
        paket = db.session.get(Paket, ctx["paket_id"])
        SesiService.tambah_waktu_sesi(ctx["sesi_id"], paket, operator="kasir", client_request_id="req-1")
        with pytest.raises(ValueError, match="sudah diproses"):
            SesiService.tambah_waktu_sesi(ctx["sesi_id"], paket, operator="kasir", client_request_id="req-1")
        assert Transaksi.query.filter_by(jenis="tambah_waktu_guest").count() == 1


def test_tambah_waktu_tanpa_kunci_tetap_jalan(ctx):
    with ctx["app"].app_context():
        paket = db.session.get(Paket, ctx["paket_id"])
        SesiService.tambah_waktu_sesi(ctx["sesi_id"], paket, operator="kasir")
        SesiService.tambah_waktu_sesi(ctx["sesi_id"], paket, operator="kasir")
        assert Transaksi.query.filter_by(jenis="tambah_waktu_guest").count() == 2


def test_checkout_duplikat_ditolak(ctx):
    with ctx["app"].app_context():
        db.session.add(User(username="kasir", password_hash="x", role="kasir"))
        menu = MenuItem(nama="Kopi", harga=5000, stok=10)
        db.session.add(menu)
        db.session.commit()
        items = [{"menu_id": menu.id, "jumlah": 1}]
        MenuService.checkout_menu_order(items, None, "kasir", metode_pembayaran="QRIS", client_request_id="chk-1")
        with pytest.raises(ValueError, match="sudah diproses"):
            MenuService.checkout_menu_order(items, None, "kasir", metode_pembayaran="QRIS", client_request_id="chk-1")
