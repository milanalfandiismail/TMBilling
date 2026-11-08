import pytest

from app import create_app
from app.models import db, User, MikroTikConfig


@pytest.fixture
def admin_client(tmp_path):
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path/'mikrotik.db'}",
    })
    with app.app_context():
        db.create_all()
        admin = User.query.filter_by(username="admin").first()
        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["kasir_id"] = admin.id
                sess["kasir_username"] = admin.username
                sess["kasir_role"] = "admin"
            yield client
        db.session.remove()
        db.drop_all()


def test_simpan_config_null_saat_disabled(admin_client):
    res = admin_client.post("/api/v1/kasir/mikrotik/config", json={
        "enabled": False, "host": None, "username": None, "port": 8728,
    })
    assert res.status_code == 200
    config = MikroTikConfig.get_instance()
    assert config.host == ""
    assert config.username == ""
