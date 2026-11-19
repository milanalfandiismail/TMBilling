import pytest

from app import create_app
from app.models import db, Game, Grup, Member, Paket, PC, User
from app.services.grup.grup_service import GrupService
from app.services.pc.pc_service import PCService


@pytest.fixture
def ctx():
    app = create_app({"TESTING": True, "WTF_CSRF_ENABLED": False,
                      "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler", keterangan="Reguler", warna="#888888")
        admin = User(username="admin_list", password_hash="x", role="admin", aktif=True)
        db.session.add_all([grup, admin])
        db.session.commit()

        client = app.test_client()
        with client.session_transaction() as s:
            s["kasir_id"] = admin.id
            s["kasir_username"] = admin.username
            s["kasir_role"] = "admin"
        yield app, client, grup
        db.session.remove()
        db.drop_all()


def test_list_pc_tidak_memuat_arsip_kecuali_diminta(ctx):
    app, client, grup = ctx
    aktif = PC(kode="PC-AKTIF", nama="Aktif", grup_id=grup.id, aktif=True)
    arsip = PC(kode="PC-ARSIP", nama="Arsip", grup_id=grup.id, aktif=False)
    db.session.add_all([aktif, arsip])
    db.session.commit()

    default = client.get("/api/v1/kasir/pc/").get_json()["pc_list"]
    assert all(item["aktif"] for item in default)

    semua = client.get("/api/v1/kasir/pc/?include_arsip=1").get_json()["pc_list"]
    assert any(item["aktif"] is False for item in semua)


def test_list_paket_member_user_game_tidak_memuat_arsip(ctx):
    app, client, grup = ctx
    db.session.add_all([
        Paket(nama="Paket Arsip", durasi_menit=60, harga=5000, grup_id=grup.id, aktif=False),
        Paket(nama="Paket Aktif", durasi_menit=60, harga=6000, grup_id=grup.id, aktif=True),
        Member(username="member_arsip", password_hash="x", grup_id=grup.id, aktif=False),
        Member(username="member_aktif", password_hash="x", grup_id=grup.id, aktif=True),
        User(username="kasir_arsip", password_hash="x", role="kasir", aktif=False),
        Game(nama="Game Arsip", tipe="game", aktif=False),
        Game(nama="Game Aktif", tipe="game", aktif=True),
    ])
    db.session.commit()

    paket = client.get("/api/v1/kasir/paket/").get_json()["paket"]
    assert [p["nama"] for p in paket] == ["Paket Aktif"]
    paket_all = client.get("/api/v1/kasir/paket/?include_arsip=1").get_json()["paket"]
    assert len(paket_all) == 2

    member = client.get("/api/v1/kasir/member/").get_json()["members"]
    assert [m["username"] for m in member] == ["member_aktif"]
    member_all = client.get("/api/v1/kasir/member/?include_arsip=1").get_json()["members"]
    assert len(member_all) == 2

    user = client.get("/api/v1/kasir/user/").get_json()
    assert all(u["aktif"] for u in user)
    user_all = client.get("/api/v1/kasir/user/?include_arsip=1").get_json()
    assert any(u["aktif"] is False for u in user_all)

    game = client.get("/api/v1/kasir/game/").get_json()["data"]
    assert [g["nama"] for g in game] == ["Game Aktif"]
    game_all = client.get("/api/v1/kasir/game/?include_arsip=1").get_json()["data"]
    assert len(game_all) == 2


def test_list_grup_tidak_memuat_arsip_kecuali_diminta(ctx):
    app, client, grup = ctx
    arsip = GrupService.create({"nama": "grup-arsip"})
    GrupService.archive(arsip.id)

    default = client.get("/api/v1/kasir/grup/").get_json()["grup"]
    assert [g["nama"] for g in default] == ["reguler"]

    semua = client.get("/api/v1/kasir/grup/?include_arsip=1").get_json()["grup"]
    assert len(semua) == 2
