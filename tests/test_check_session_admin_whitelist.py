import pytest

from app import create_app
from app.models import db, User
from app.services.ip_whitelist.ip_whitelist_service import IpWhitelistService


@pytest.fixture
def admin_client(tmp_path):
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path/'check.db'}",
    })
    with app.app_context():
        db.create_all()
        admin = User.query.filter_by(username="admin").first()
        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["kasir_id"] = admin.id
            yield client
        db.session.remove()
        db.drop_all()


def test_admin_di_luar_whitelist_tetap_login(admin_client, monkeypatch):
    monkeypatch.setattr(IpWhitelistService, "is_enabled", staticmethod(lambda: True))
    monkeypatch.setattr(IpWhitelistService, "is_session_token_valid", staticmethod(lambda *a: False))
    monkeypatch.setattr(IpWhitelistService, "is_ip_whitelisted", staticmethod(lambda ip: False))
    res = admin_client.get("/api/v1/kasir/auth/check")
    assert res.status_code == 200
    assert res.get_json()["logged_in"] is True
