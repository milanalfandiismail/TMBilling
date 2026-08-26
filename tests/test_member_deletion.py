import unittest
from app import create_app
from app.models import db, Member, Grup
from app.services.member.member_service import MemberService

class TestMemberDeletion(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

        # Buat grup reguler
        self.grup = Grup(nama="reguler", warna="#3b82f6")
        db.session.add(self.grup)
        db.session.commit()

        # Buat member dummy
        self.member = Member(
            username="dummy_member",
            nama_lengkap="Dummy Member",
            waktu_tersimpan=120,
            grup_id=self.grup.id,
            no_hp="08123456789",
            email="dummy@example.com"
        )
        self.member.set_password("password123")
        db.session.add(self.member)
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_delete_member_success_no_lazy_load_exception(self):
        # Pastikan member ada di database sebelum dihapus
        self.assertIsNotNone(Member.query.filter_by(username="dummy_member").first())

        # Panggil MemberService.delete dan pastikan tidak melempar Exception (LazyLoad/DetachedInstanceError)
        deleted_member = MemberService.delete(self.member.id, operator="admin")

        # Pastikan data yang dikembalikan memiliki atribut username yang benar
        self.assertEqual(deleted_member.username, "dummy_member")

        # Pastikan member sudah tidak ada di database
        db_member = Member.query.filter_by(username="dummy_member").first()
        self.assertIsNone(db_member)
