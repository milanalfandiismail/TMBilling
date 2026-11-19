import pytest
from flask import template_rendered
from app import create_app, db
from app.models import Member, Transaksi, Grup


@pytest.fixture
def ctx():
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
    })
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler", keterangan="Reguler", warna="#888888")
        db.session.add(grup)
        db.session.commit()
        member = Member(username="budi", nama_lengkap="Budi", aktif=True, grup_id=grup.id)
        member.set_password("pass123")
        db.session.add(member)
        db.session.commit()
        db.session.add_all([
            Transaksi(no_nota="TM-20260101-001", jenis="beli_paket_guest", jumlah=50000,
                      menit=60, member_id=member.id, is_refunded=True),
            Transaksi(no_nota="TM-20260101-002", jenis="refund_paket", jumlah=-50000,
                      menit=0, member_id=member.id, is_refunded=False),
            Transaksi(no_nota="TM-20260101-003", jenis="tambah_waktu_guest", jumlah=20000,
                      menit=30, member_id=member.id, is_refunded=False),
        ])
        db.session.commit()
        yield app, member


def test_total_belanja_member_tidak_negatif(ctx):
    app, member = ctx
    recorded = []
    def _record(sender, template, context, **extra):
        recorded.append(context)
    template_rendered.connect(_record, app)
    client = app.test_client()
    with client.session_transaction() as sess:
        sess["member_id"] = member.id
        sess["member_username"] = member.username
        sess["member_role"] = "member"

    resp = client.get("/member")

    assert resp.status_code == 200
    assert recorded[0]["total_spent"] == 20000
