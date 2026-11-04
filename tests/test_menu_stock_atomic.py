import unittest
from app import create_app
from app.models import db, MenuItem
from app.repositories import MenuRepository


class TestMenuStockAtomic(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()
        self.menu = MenuItem(nama="Kopi Uji", harga=5000, stok=1, is_active=True)
        db.session.add(self.menu)
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def test_second_decrement_fails_when_stock_exhausted(self):
        self.assertTrue(MenuRepository.decrement_stok_if_available(self.menu.id, 1))
        db.session.commit()
        self.assertFalse(MenuRepository.decrement_stok_if_available(self.menu.id, 1))
        db.session.rollback()
        self.assertEqual(MenuItem.query.get(self.menu.id).stok, 0)

    def test_unlimited_stock_is_untouched(self):
        self.menu.stok = -1
        db.session.commit()
        self.assertTrue(MenuRepository.decrement_stok_if_available(self.menu.id, 5))
        self.assertEqual(MenuItem.query.get(self.menu.id).stok, -1)
