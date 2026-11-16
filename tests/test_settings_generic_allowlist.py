from app import create_app, db
from app.models import User


def test_generic_setting_rejects_security_key():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
                      "SECRET_KEY": "test-settings-allow", "WTF_CSRF_ENABLED": False})
    with app.app_context():
        db.create_all()
        u = User(username="adminr", nama_lengkap="Admin", role="admin", aktif=True)
        u.set_password("x"); db.session.add(u); db.session.commit()
        client = app.test_client()
        with client.session_transaction() as s:
            s["kasir_id"] = u.id; s["kasir_username"] = "adminr"; s["kasir_role"] = "admin"
        assert client.put("/api/v1/kasir/settings/emergency_token", json={"value": "palsu"}).status_code == 400
        assert client.put("/api/v1/kasir/settings/warnet_title", json={"value": "Warnet"}).status_code == 200
