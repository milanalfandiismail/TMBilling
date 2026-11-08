import pytest

from app import create_app
from app.models import db, Grup, Member, Sesi
from app.services.member.member_service import MemberService


@pytest.fixture
def app_ctx(tmp_path):
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path/'member.db'}",
    })
    with app.app_context():
        db.create_all()
        yield
        db.session.remove()
        db.drop_all()


def test_hapus_member_dengan_riwayat_ditolak(app_ctx):
    grup = Grup(nama="Reguler")
    member = Member(username="budi", nama_lengkap="Budi", grup=grup)
    member.set_password("rahasia123")
    db.session.add_all([grup, member])
    db.session.flush()
    sesi = Sesi(tipe="member", member_id=member.id, status="selesai")
    db.session.add(sesi)
    db.session.commit()

    with pytest.raises(ValueError, match="riwayat"):
        MemberService.delete(member.id, operator="admin")
    assert db.session.get(Member, member.id) is not None
    assert db.session.get(Sesi, sesi.id).member_id == member.id
