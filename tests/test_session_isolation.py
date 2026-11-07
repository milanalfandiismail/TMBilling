import pytest
from app import create_app
from app.models import db, Grup, Member, User


@pytest.fixture
def client():
    app = create_app({"TESTING": True, "WTF_CSRF_ENABLED": False,
                      "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler", keterangan="Reguler", warna="#888888")
        db.session.add(grup); db.session.commit()
        kasir = User(username="kasir1", nama_lengkap="Kasir", role="kasir", aktif=True)
        kasir.set_password("kasir123")
        member = Member(username="m1", nama_lengkap="M1", grup_id=grup.id,
                        waktu_tersimpan=0, aktif=True)
        member.set_password("member123")
        db.session.add_all([kasir, member])
        db.session.commit()
    return app.test_client()


def test_login_kasir_menghapus_session_member(client):
    client.post("/member/login", json={"username": "m1", "password": "member123"})
    client.post("/api/v1/kasir/auth/login", json={"username": "kasir1", "password": "kasir123"})
    with client.session_transaction() as sess:
        assert sess.get("kasir_id")
        assert "member_id" not in sess
