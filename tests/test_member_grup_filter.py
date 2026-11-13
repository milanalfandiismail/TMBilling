import unittest

from app import create_app
from app.models import db, Grup, Member


class TestMemberGrupFilter(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            "TESTING": True, "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "SECRET_KEY": "test-member-grup-filter",
        })
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def test_to_dict_member_memuat_grup_id(self):
        grup = Grup(nama="reguler", warna="#3B82F6")
        db.session.add(grup)
        db.session.commit()
        member = Member(username="mfilter", password_hash="x", grup_id=grup.id)
        db.session.add(member)
        db.session.commit()

        # Pill grup arsip mencocokkan item.grup_id, jadi nilainya wajib ikut terserialisasi.
        self.assertEqual(member.to_dict()["grup_id"], grup.id)
        self.assertEqual(member.to_dict()["grup"], "reguler")
