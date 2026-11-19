import unittest

from sqlalchemy import inspect

from app import create_app
from app.models import db


class TestTransaksiMenuIndex(unittest.TestCase):
    def setUp(self):
        self.app = create_app({
            "TESTING": True, "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "SECRET_KEY": "test-menu-index",
        })
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def test_tanggal_index_exists(self):
        names = {ix["name"] for ix in inspect(db.engine).get_indexes("transaksi_menu")}
        self.assertIn("ix_transaksi_menu_tanggal", names)
