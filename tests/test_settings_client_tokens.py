import unittest
from app import create_app
from app.models import db
from app.services import SettingsService


class TestClientTokens(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def test_tokens_are_generated_and_stable(self):
        for getter, legacy in (
            (SettingsService.get_or_create_emergency_token, "TM123qaz!@#"),
            (SettingsService.get_or_create_uninstall_token, "TM_UNINSTALL_SAFE_2026"),
        ):
            token = getter()
            self.assertGreaterEqual(len(token), 20)
            self.assertNotEqual(token, legacy)
            self.assertEqual(token, getter())
