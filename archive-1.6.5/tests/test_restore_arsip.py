import pytest

from app import create_app
from app.models import db, Game, Grup, Member, Paket, PC, User
from app.services.game.game_service import GameService
from app.services.member.member_service import MemberService
from app.services.paket.paket_service import PaketService
from app.services.pc.pc_service import PCService
from app.services.user.user_service import UserService


@pytest.fixture
def ctx():
    app = create_app({"TESTING": True, "WTF_CSRF_ENABLED": False,
                      "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler", keterangan="Reguler", warna="#888888")
        db.session.add(grup)
        db.session.commit()
        yield app
        db.session.remove()
        db.drop_all()


def test_restore_pc(ctx):
    grup = Grup.query.first()
    pc = PC(kode="PC-R1", nama="PC Restore", grup_id=grup.id)
    db.session.add(pc)
    db.session.commit()
    pc_id = pc.id

    PCService.archive(pc_id)
    assert db.session.get(PC, pc_id).aktif is False

    PCService.restore(pc_id)
    assert db.session.get(PC, pc_id).aktif is True
    with pytest.raises(ValueError, match="tidak dalam arsip"):
        PCService.restore(pc_id)


def test_restore_paket_member(ctx):
    grup = Grup.query.first()
    paket = Paket(nama="Paket Restore", durasi_menit=60, harga=5000, grup_id=grup.id, aktif=True)
    member = Member(username="member_restore", password_hash="x", grup_id=grup.id, aktif=True)
    db.session.add_all([paket, member])
    db.session.commit()
    paket_id, member_id = paket.id, member.id

    PaketService.archive(paket_id)
    MemberService.archive(member_id)
    PaketService.restore(paket_id)
    MemberService.restore(member_id)

    assert db.session.get(Paket, paket_id).aktif is True
    assert db.session.get(Member, member_id).aktif is True
    with pytest.raises(ValueError, match="tidak dalam arsip"):
        PaketService.restore(paket_id)
    with pytest.raises(ValueError, match="tidak dalam arsip"):
        MemberService.restore(member_id)


def test_restore_user_dan_game(ctx):
    user = User(username="kasir_restore", password_hash="x", role="kasir", aktif=True)
    game = Game(nama="Game Restore", tipe="game", aktif=True)
    db.session.add_all([user, game])
    db.session.commit()
    user_id, game_id = user.id, game.id

    UserService.archive_user(user_id)
    GameService.archive(game_id)
    UserService.restore_user(user_id)
    GameService.restore(game_id)

    assert db.session.get(User, user_id).aktif is True
    assert db.session.get(Game, game_id).aktif is True
    with pytest.raises(ValueError, match="tidak dalam arsip"):
        UserService.restore_user(user_id)
    with pytest.raises(ValueError, match="tidak dalam arsip"):
        GameService.restore(game_id)


def test_route_restore_pc(ctx):
    grup = Grup.query.first()
    pc = PC(kode="PC-R2", nama="PC Route", grup_id=grup.id)
    admin = User(username="admin_restore", password_hash="x", role="admin", aktif=True)
    db.session.add_all([pc, admin])
    db.session.commit()

    client = ctx.test_client()
    with client.session_transaction() as s:
        s["kasir_id"] = admin.id
        s["kasir_username"] = admin.username
        s["kasir_role"] = "admin"

    PCService.archive(pc.id)
    res = client.post(f"/api/v1/kasir/pc/{pc.id}/restore")
    assert res.status_code == 200
    assert db.session.get(PC, pc.id).aktif is True

    res = client.post(f"/api/v1/kasir/pc/{pc.id}/restore")
    assert res.status_code == 400
