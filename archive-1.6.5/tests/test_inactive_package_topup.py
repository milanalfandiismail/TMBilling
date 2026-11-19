import pytest

from app import create_app
from app.models import db, Grup, Member, PC, Paket, Sesi, Transaksi, now_local
from app.services.member.member_service import MemberService
from app.services.sesi.sesi_service import SesiService


@pytest.fixture
def ctx():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.flush()
        paket = Paket(nama="Paket Mati", durasi_menit=60, harga=12000, grup_id=grup.id, aktif=False)
        pc = PC(kode="PC-01", nama="PC 01", grup_id=grup.id)
        member = Member(username="m-mati", nama_lengkap="M", grup_id=grup.id, waktu_tersimpan=0, aktif=True)
        member.set_password("x")
        sesi = Sesi(tipe="guest", nama_guest="Tamu", pc_id=pc.id, paket_id=paket.id,
                    durasi_beli_menit=60, total_bayar=12000, status="aktif",
                    mulai_pada=now_local(), waktu_mulai_sesi=now_local(),
                    last_sync=now_local(), token_sesi="i" * 64)
        db.session.add_all([paket, pc, member, sesi])
        db.session.commit()
        yield {"paket": paket, "member": member, "sesi": sesi}
        db.session.remove()
        db.drop_all()


def test_inactive_package_rejected_for_guest_session_topup(ctx):
    sesi = ctx["sesi"]
    with pytest.raises(ValueError, match="Paket tidak aktif"):
        SesiService.tambah_waktu_sesi(sesi.id, ctx["paket"])

    db.session.expire_all()
    assert db.session.get(Sesi, sesi.id).durasi_beli_menit == 60
    assert Transaksi.query.filter_by(sesi_id=sesi.id, jenis="tambah_waktu_guest").count() == 0


def test_inactive_package_rejected_for_member_topup(ctx):
    member = ctx["member"]
    with pytest.raises(ValueError, match="Paket tidak aktif"):
        MemberService.tambah_waktu(member.id, ctx["paket"])

    db.session.expire_all()
    assert db.session.get(Member, member.id).waktu_tersimpan == 0
    assert Transaksi.query.filter_by(member_id=member.id).count() == 0
