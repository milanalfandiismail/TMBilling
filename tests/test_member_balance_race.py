import threading, time
import pytest
from app import create_app
from app.models import db, Grup, Member, Paket
from app.services.member.member_service import MemberService
from app.repositories.member.member_repository import MemberRepository


@pytest.fixture
def ctx(tmp_path):
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path/'race.db'}"})
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler", keterangan="Reguler", warna="#888888")
        db.session.add(grup); db.session.commit()
        paket = Paket(nama="Paket 1 Jam", durasi_menit=60, harga=12000, grup_id=grup.id, aktif=True, kadaluarsa_hari=30)
        member = Member(username="member1", password_hash="x", nama_lengkap="Member 1", grup_id=grup.id,
                        waktu_tersimpan=0, aktif=True)
        db.session.add_all([paket, member]); db.session.commit()
        yield {"app": app, "member_id": member.id, "paket_id": paket.id}


def test_dua_topup_paralel_tidak_hilang(ctx, monkeypatch):
    original = MemberRepository.get_by_id
    def slow(member_id):
        m = original(member_id)
        time.sleep(0.15)
        return m
    monkeypatch.setattr(MemberRepository, "get_by_id", staticmethod(slow))

    errors = []
    def run():
        with ctx["app"].app_context():
            try:
                paket = db.session.get(Paket, ctx["paket_id"])
                MemberService.tambah_waktu(ctx["member_id"], paket, operator="kasir", qty=1)
            except Exception as e:  # pragma: no cover
                errors.append(e)

    threads = [threading.Thread(target=run) for _ in range(2)]
    [t.start() for t in threads]; [t.join() for t in threads]

    assert errors == []
    with ctx["app"].app_context():
        member = db.session.get(Member, ctx["member_id"])
        assert member.waktu_tersimpan == 120
