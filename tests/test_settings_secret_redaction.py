import unittest
from app import create_app
from app.models import db, User
from app.services import SettingsService


class TestSettingsSecretRedaction(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.app.config["WTF_CSRF_ENABLED"] = False
        self.app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
        self.client = self.app.test_client()
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def _login(self, role):
        user = User.query.filter_by(username=f"u_{role}").first()
        if not user:
            user = User(username=f"u_{role}", nama_lengkap=role, role=role, aktif=True)
            user.set_password("rahasia123")
            db.session.add(user)
            db.session.commit()
        with self.client.session_transaction() as sess:
            sess["kasir_id"] = user.id
            sess["kasir_username"] = user.username
            sess["kasir_role"] = role

    def test_kasir_only_gets_whitelisted_settings(self):
        SettingsService.set("payment_methods", "Tunai,QRIS")
        SettingsService.set("mikrotik_password", "rahasia-mikrotik")
        self._login("kasir")
        res = self.client.get("/api/v1/kasir/settings/")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()["settings"]
        self.assertEqual(data.get("payment_methods"), "Tunai,QRIS")
        self.assertNotIn("mikrotik_password", data)
        self.assertNotIn("client_api_key", data)
        self.assertNotIn("uninstall_token", data)

    def test_admin_gets_full_settings_and_client_api_key(self):
        SettingsService.set("mikrotik_password", "rahasia-mikrotik")
        self._login("admin")
        data = self.client.get("/api/v1/kasir/settings/").get_json()["settings"]
        self.assertIn("client_api_key", data)
        self.assertEqual(data.get("mikrotik_password"), "rahasia-mikrotik")
