import unittest

from app import create_app
from app.models import db, Grup, Member
from app.services.member.member_service import MemberService


class TestMemberGrupCounts(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            "TESTING": True, "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "SECRET_KEY": "test-member-grup-counts",
        })
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def _seed(self):
        reguler = Grup(nama="reguler", warna="#3B82F6")
        vip = Grup(nama="vip", warna="#F59E0B")
        db.session.add_all([reguler, vip])
        db.session.commit()
        db.session.add_all([
            Member(username="a", password_hash="x", grup_id=reguler.id, aktif=True),
            Member(username="b", password_hash="x", grup_id=reguler.id, aktif=True),
            Member(username="c", password_hash="x", grup_id=reguler.id, aktif=False),
            Member(username="d", password_hash="x", grup_id=vip.id, aktif=False),
        ])
        db.session.commit()
        return reguler, vip

    def test_counts_mengikuti_mode_aktif_dan_arsip(self):
        reguler, vip = self._seed()

        aktif = MemberService.get_paginated_members(aktif_only=True)["grup_counts"]
        arsip = MemberService.get_paginated_members(aktif_only=False)["grup_counts"]

        self.assertEqual(aktif.get(str(reguler.id)), 2)
        self.assertIsNone(aktif.get(str(vip.id)))
        self.assertEqual(arsip.get(str(reguler.id)), 3)
        self.assertEqual(arsip.get(str(vip.id)), 1)
