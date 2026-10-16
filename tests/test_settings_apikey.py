import unittest
from app import create_app
from app.models import db, User

class TestSettingsApiKey(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.app.config["WTF_CSRF_ENABLED"] = False
        self.app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_update_client_api_key_endpoint(self):
        admin = User.query.filter_by(username="admin").first()
        assert admin is not None

        # Login kasir session
        with self.client.session_transaction() as sess:
            sess["kasir_id"] = admin.id
            sess["kasir_username"] = admin.username
            sess["kasir_role"] = "admin"

        res = self.client.put("/api/v1/kasir/settings/apikey", json={"value": "TM2026-NEW-API-KEY-12345"})
        assert res.status_code == 200
        data = res.get_json()
        assert data["success"] is True
        assert self.app.config["CLIENT_API_KEY"] == "TM2026-NEW-API-KEY-12345"
