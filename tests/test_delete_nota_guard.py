import pytest
from app import create_app
from app.models import db, Grup, Member, Paket, Transaksi
from app.services.report.log_audit_service import LogAuditService


@pytest.fixture
def ctx():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler", keterangan="Reguler", warna="#888888")
        db.session.add(grup); db.session.commit()
        paket = Paket(nama="Paket 1 Jam", durasi_menit=60, harga=12000, grup_id=grup.id, aktif=True)
        member = Member(username="m1", password_hash="x", nama_lengkap="M1", grup_id=grup.id, waktu_tersimpan=60, aktif=True)
        db.session.add_all([paket, member]); db.session.commit()
        nota = Transaksi(member_id=member.id, paket_id=paket.id, jenis="beli_paket_member",
                         jumlah=12000, menit=60, no_nota="TM-20260101-1", metode_pembayaran="Tunai")
        db.session.add(nota); db.session.commit()
        yield {"app": app, "nota_id": nota.id}


def test_hapus_nota_paket_ditolak(ctx):
    with ctx["app"].app_context():
        with pytest.raises(ValueError, match="Refund"):
            LogAuditService.delete_transaction(ctx["nota_id"], operator="admin")
        assert Transaksi.query.count() == 1
