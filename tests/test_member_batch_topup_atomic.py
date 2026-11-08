import pytest

from app import create_app
from app.models import db, Grup, Member, Paket, Transaksi, User


@pytest.fixture
def app_ctx(tmp_path):
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path/'batch.db'}",
    })
    with app.app_context():
        db.create_all()
        grup_a = Grup(nama="reguler", keterangan="Reguler", warna="#888888")
        grup_b = Grup(nama="vip", keterangan="VIP", warna="#FFD700")
        db.session.add_all([grup_a, grup_b])
        db.session.flush()
        paket_valid = Paket(nama="Paket 1 Jam", durasi_menit=60, harga=10000,
                            grup_id=grup_a.id, aktif=True, kadaluarsa_hari=30)
        paket_lain = Paket(nama="Paket VIP", durasi_menit=60, harga=20000,
                           grup_id=grup_b.id, aktif=True, kadaluarsa_hari=30)
        member = Member(username="member1", nama_lengkap="Member 1", grup_id=grup_a.id,
                        waktu_tersimpan=0, aktif=True)
        member.set_password("rahasia")
        db.session.add_all([paket_valid, paket_lain, member])
        db.session.commit()

        client = app.test_client()
        admin = User.query.filter_by(username="admin").first()
        with client.session_transaction() as sess:
            sess["kasir_id"] = admin.id
            sess["kasir_username"] = admin.username
            sess["kasir_role"] = "admin"
            sess["kasir_nama"] = admin.nama_lengkap
        yield client, member, paket_valid, paket_lain
        db.session.remove()
        db.drop_all()


def test_selection_kedua_invalid_tidak_memotong_selection_pertama(app_ctx):
    client, member, paket_valid, paket_lain = app_ctx
    saldo_awal = member.waktu_tersimpan
    res = client.post("/api/v1/kasir/member/tambah-waktu", json={
        "member_id": member.id,
        "metode_pembayaran": "Tunai",
        "selections": [
            {"paket_id": paket_valid.id, "qty": 1},
            {"paket_id": paket_lain.id, "qty": 1},
        ],
    })
    assert res.status_code == 400
    db.session.refresh(member)
    assert member.waktu_tersimpan == saldo_awal
    assert Transaksi.query.filter_by(member_id=member.id, jenis="beli_paket_member").count() == 0
