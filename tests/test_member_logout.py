import pytest

from app import create_app
from app.models import db, Grup, Member, PC, Sesi, now_local


@pytest.fixture
def app_ctx(tmp_path):
    app = create_app({
        "TESTING": True,
        "CLIENT_API_KEY": "test-key",
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path/'logout.db'}",
    })
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler", keterangan="Reguler", warna="#888888")
        db.session.add(grup)
        db.session.flush()
        member = Member(username="member1", nama_lengkap="Member 1", grup_id=grup.id,
                        waktu_tersimpan=0, aktif=True)
        member.set_password("rahasia")
        pc = PC(kode="PC-1", ip_address="10.10.10.1", mac_address="AA:BB:CC:DD:EE:01", grup_id=grup.id)
        db.session.add_all([member, pc])
        db.session.flush()
        token = "tok" + "a" * 61
        sesi = Sesi(tipe="member", member_id=member.id, pc_id=pc.id, status="aktif",
                    token_sesi=token, durasi_beli_menit=60, total_bayar=10000,
                    waktu_mulai_sesi=now_local())
        db.session.add(sesi)
        db.session.commit()

        client = app.test_client()
        yield client, pc, member, token
        db.session.remove()
        db.drop_all()


def test_member_logout_menutup_sesi(app_ctx):
    client, pc, member, token = app_ctx
    res = client.post("/api/v1/public/auth/logout", json={
        "ip_address": pc.ip_address,
        "mac_address": pc.mac_address,
        "token_sesi": token,
    }, headers={"X-Client-Key": "test-key"})
    assert res.status_code == 200
    assert res.get_json()["success"] is True
    assert Sesi.query.filter_by(pc_id=pc.id, status="aktif").first() is None
