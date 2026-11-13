import pytest

from app import create_app
from app.models import db, Grup, Paket, PC, Sesi, Transaksi, User, Game
from app.services.game.game_service import GameService
from app.services.paket.paket_service import PaketService
from app.services.user.user_service import UserService


@pytest.fixture
def ctx():
    app = create_app({"TESTING": True, "WTF_CSRF_ENABLED": False,
                      "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler", keterangan="Reguler", warna="#888888")
        admin = User(username="admin_uji", password_hash="x", role="admin", aktif=True)
        db.session.add_all([grup, admin])
        db.session.commit()
        yield app
        db.session.remove()
        db.drop_all()


def test_arsip_paket_hanya_menonaktifkan(ctx):
    grup = Grup.query.first()
    paket = Paket(nama="Paket Pagi", durasi_menit=60, harga=5000, grup_id=grup.id, aktif=True)
    db.session.add(paket)
    db.session.commit()

    PaketService.archive(paket.id, operator="admin")

    assert db.session.get(Paket, paket.id).aktif is False


def test_purge_paket_melepas_referensi_sesi_dan_transaksi(ctx):
    grup = Grup.query.first()
    paket = Paket(nama="Paket Hapus", durasi_menit=60, harga=5000, grup_id=grup.id, aktif=True)
    pc = PC(kode="PC-H", nama="PC Hapus", grup_id=grup.id)
    db.session.add_all([paket, pc])
    db.session.commit()
    sesi = Sesi(tipe="guest", nama_guest="Uji", pc_id=pc.id, paket_id=paket.id, status="selesai")
    db.session.add(sesi)
    db.session.commit()
    trx = Transaksi(no_nota="TM-PURGE-1", jenis="beli_paket_guest", jumlah=5000, menit=60,
                    sesi_id=sesi.id, paket_id=paket.id)
    db.session.add(trx)
    db.session.commit()
    paket_id, sesi_id, trx_id = paket.id, sesi.id, trx.id

    PaketService.delete(paket_id, operator="admin")

    assert db.session.get(Paket, paket_id) is None
    assert db.session.get(Sesi, sesi_id).paket_id is None
    assert db.session.get(Transaksi, trx_id).paket_id is None


def test_arsip_game_dan_user_menonaktifkan(ctx):
    game = Game(nama="Game Lama", tipe="game", aktif=True)
    user = User(username="kasir_lama", password_hash="x", role="kasir", aktif=True)
    db.session.add_all([game, user])
    db.session.commit()

    GameService.archive(game.id, operator="admin")
    UserService.archive_user(user.id, operator="admin")

    assert db.session.get(Game, game.id).aktif is False
    assert db.session.get(User, user.id).aktif is False


def test_hapus_paket_tanpa_konfirmasi_ditolak(ctx):
    grup = Grup.query.first()
    paket = Paket(nama="Paket Konfirmasi", durasi_menit=60, harga=5000, grup_id=grup.id, aktif=True)
    admin = User.query.first()
    db.session.add(paket)
    db.session.commit()
    paket_id, admin_id = paket.id, admin.id

    client = ctx.test_client()
    with client.session_transaction() as s:
        s["kasir_id"] = admin_id
        s["kasir_username"] = admin.username
        s["kasir_role"] = "admin"

    res = client.delete(f"/api/v1/kasir/paket/{paket_id}", json={})
    assert res.status_code == 400

    res = client.delete(f"/api/v1/kasir/paket/{paket_id}", json={"confirm": "Paket Konfirmasi"})
    assert res.status_code == 200
    assert db.session.get(Paket, paket_id) is None
