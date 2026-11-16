import pytest
from app import create_app, db
from app.models import Grup, PC, Member, Sesi, now_local


@pytest.fixture
def ctx():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler", keterangan="Reguler", warna="#888888")
        db.session.add(grup)
        db.session.commit()
        pc = PC(kode="PC-01", nama="PC 01", ip_address="10.0.0.1", grup_id=grup.id, aktif=True)
        member = Member(username="budi", nama_lengkap="Budi", aktif=True, grup_id=grup.id)
        member.set_password("pass123")
        db.session.add_all([pc, member])
        db.session.commit()
        db.session.add(Sesi(tipe="member", member_id=member.id, pc_id=pc.id,
                            status="aktif", durasi_beli_menit=60, mulai_pada=now_local()))
        db.session.commit()
        yield app


def test_pc_status_tidak_menampilkan_username_member(ctx):
    client = ctx.test_client()
    resp = client.get("/pc-status")

    assert resp.status_code == 200
    body = resp.get_data(as_text=True)
    item = next(x for x in resp.get_json() if x["kode"] == "PC-01")
    assert item["nama"] == "Member"
    assert "budi" not in body
