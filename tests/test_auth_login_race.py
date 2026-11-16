import pytest
from sqlalchemy.exc import IntegrityError
from app import create_app, db
from app.models import Grup, Member, PC
from app.services.auth.auth_service import AuthService


def test_login_race_tidak_menjadi_500(monkeypatch):
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
    })
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.commit()
        pc = PC(kode="PC-LOGIN", nama="PC Login", grup_id=grup.id,
                ip_address="10.0.0.20", mac_address="AA:BB:CC:DD:EE:20", aktif=True)
        member = Member(username="member_race", nama_lengkap="Member Race",
                        grup_id=grup.id, aktif=True, waktu_tersimpan=60)
        member.set_password("pass123")
        db.session.add_all([pc, member])
        db.session.commit()

        def gagal_commit():
            raise IntegrityError("INSERT", {}, Exception("UNIQUE constraint failed: sesi.member_id"))

        monkeypatch.setattr(db.session, "commit", gagal_commit)

        with pytest.raises(ValueError, match="sedang dipakai"):
            AuthService.login(
                "member_race", "pass123",
                "10.0.0.20", "AA:BB:CC:DD:EE:20",
            )

        db.session.rollback()
