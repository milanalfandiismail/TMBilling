from datetime import timedelta

from app import create_app
from app.models import db, Grup, Member, now_local
from app.services.member.member_service import MemberService


def test_get_by_id_tidak_commit(tmp_path, monkeypatch):
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path/'mem.db'}"})
    with app.app_context():
        g = Grup(nama="reguler")
        db.session.add(g)
        db.session.commit()
        m = Member(
            username="m1",
            grup_id=g.id,
            waktu_tersimpan=60,
            kadaluarsa_pada=now_local() - timedelta(days=1),
            aktif=True,
        )
        m.set_password("rahasia")
        db.session.add(m)
        db.session.commit()
        called = []
        monkeypatch.setattr(db.session, "commit", lambda: called.append(1))
        result = MemberService.get_by_id(m.id)
        assert result.waktu_tersimpan == 0
        assert called == []
