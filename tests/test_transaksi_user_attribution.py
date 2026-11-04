# tests/test_transaksi_user_attribution.py
import unittest
import pytest
from app import create_app
from app.models import db, User
from app.services import TransaksiService
from app.services.menu.menu_service import MenuService


class TestTransaksiUserAttribution(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()

        admin = User(username="admin_pertama", nama_lengkap="Admin Pertama", role="admin", aktif=True)
        admin.set_password("rahasia123")
        db.session.add(admin)
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def test_unknown_operator_is_not_attributed_to_first_admin(self):
        self.assertIsNone(TransaksiService.get_user_id("user_yang_tidak_ada"))

    def test_checkout_rejects_unknown_cashier(self):
        with pytest.raises(ValueError, match="Kasir tidak valid"):
            MenuService.checkout_menu_order(
                [{"menu_id": 1, "jumlah": 1}], "PC-01", "user_yang_tidak_ada"
            )
