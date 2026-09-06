# tests/test_branch_media_proxy.py
import pytest
from unittest.mock import patch, MagicMock
from app import create_app
from app.models import db, User
from app.models.branch import Branch

@pytest.fixture
def test_setup():
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    with app.app_context():
        db.create_all()
        admin = User(username="admin_test", role="admin", aktif=True)
        admin.set_password("pass123")
        db.session.add(admin)
        db.session.commit()

        client = app.test_client()
        with client.session_transaction() as sess:
            sess['kasir_id'] = admin.id
            sess['kasir_username'] = admin.username
            sess['kasir_role'] = 'admin'
        yield client, app, admin
        db.session.remove()
        db.drop_all()

def test_proxy_branch_media_unauthorized():
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    with app.app_context():
        db.create_all()
        client = app.test_client()
        res = client.get('/api/v1/kasir/branch/1/media/uploads/screenshots/TM-01.png')
        assert res.status_code == 401
        db.session.remove()
        db.drop_all()

def test_proxy_branch_media_branch_not_found(test_setup):
    client, app, admin = test_setup
    res = client.get('/api/v1/kasir/branch/999/media/uploads/screenshots/TM-01.png')
    assert res.status_code == 404

def test_proxy_branch_media_success(test_setup):
    client, app, admin = test_setup
    with app.app_context():
        branch = Branch(nama="Cabang Remote Tes", url="http://192.168.20.10:7015", api_key="secret-key-123", aktif=True)
        db.session.add(branch)
        db.session.commit()
        branch_id = branch.id

    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.headers = {"Content-Type": "image/png"}
    fake_resp.content = b"\x89PNG\r\n\x1a\nfakeimagebinary"
    fake_resp.iter_content.return_value = [b"\x89PNG\r\n\x1a\nfakeimagebinary"]

    with patch("requests.get", return_value=fake_resp) as mock_get:
        res = client.get(f'/api/v1/kasir/branch/{branch_id}/media/uploads/screenshots/TM-14.png?t=12345')
        assert res.status_code == 200
        assert res.data == b"\x89PNG\r\n\x1a\nfakeimagebinary"
        assert res.headers.get("Content-Type") == "image/png"
        mock_get.assert_called_once()
        args, kwargs = mock_get.call_args
        assert "http://192.168.20.10:7015/static/uploads/screenshots/TM-14.png?t=12345" in args[0]
        assert kwargs["headers"]["Authorization"] == "Bearer secret-key-123"
