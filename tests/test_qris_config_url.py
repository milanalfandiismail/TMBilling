import unittest

from app import create_app
from app.models import db
from app.services import SettingsService


class TestQrisConfigUrl(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.app.config["WTF_CSRF_ENABLED"] = False
        self.app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
        self.client = self.app.test_client()
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()
        self.key = self.app.config["CLIENT_API_KEY"]

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def _get(self):
        res = self.client.get("/api/v1/public/client/warnet",
                              headers={"X-Client-Key": self.key})
        return res.get_json()

    def test_qris_path_is_relative_and_qris_url_is_absolute(self):
        SettingsService.set("app_public_url", "")
        data = self._get()
        self.assertTrue(data["qris_path"].startswith("/static/uploads/qris/"))
        self.assertEqual(data["qris_url"], f"http://localhost{data['qris_path']}")

    def test_qris_url_uses_public_url_when_set(self):
        SettingsService.set("app_public_url", "https://warnet.example.com")
        data = self._get()
        self.assertEqual(data["qris_url"], f"https://warnet.example.com{data['qris_path']}")

    def test_qris_assets_are_immutable(self):
        res = self.client.get("/static/uploads/qris/default_qris.png")
        self.assertEqual(res.headers.get("Cache-Control"),
                         "public, max-age=31536000, immutable")


if __name__ == "__main__":
    unittest.main()
