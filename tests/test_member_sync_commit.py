import unittest
from datetime import timedelta

from app import create_app
from app.models import db, Grup, Member, PC, Paket, Sesi, now_local


class TestSyncWaktuMember(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            "TESTING": True, "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "SECRET_KEY": "test-member-sync",
        })
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.flush()
        paket = Paket(nama="1 Jam", durasi_menit=60, harga=5000, grup_id=grup.id, aktif=True)
        pc = PC(kode="TM-55", nama="TM-55", grup_id=grup.id, aktif=True)
        member = Member(username="budi", grup_id=grup.id, aktif=True, waktu_tersimpan=90)
        member.set_password("rahasia")
        db.session.add_all([paket, pc, member])
        db.session.flush()
        self.sesi = Sesi(
            tipe="member", member_id=member.id, pc_id=pc.id, paket_id=paket.id,
            durasi_beli_menit=60, total_bayar=5000, status="aktif",
            waktu_tersimpan_awal=60, token_sesi="f" * 20,
            mulai_pada=now_local() - timedelta(minutes=10),
            waktu_mulai_sesi=now_local() - timedelta(minutes=10),
        )
        db.session.add(self.sesi)
        db.session.commit()
        self.member_id = member.id
        self.sesi_id = self.sesi.id

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def test_sync_does_not_commit(self):
        from app.services.sesi.sesi_service import SesiService
        sesi = db.session.get(Sesi, self.sesi_id)
        sisa = SesiService.sync_waktu_member(sesi)
        # Tanpa commit, rollback harus mengembalikan nilai lama di DB.
        db.session.rollback()
        db.session.expire_all()
        member = db.session.get(Member, self.member_id)
        self.assertEqual(member.waktu_tersimpan, 90)
        self.assertLess(sisa, 60)
