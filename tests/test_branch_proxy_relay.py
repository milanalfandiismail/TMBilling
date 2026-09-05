# tests/test_branch_proxy_relay.py
import pytest
from app import create_app
from app.models import db, User
from app.models.branch import Branch
from unittest.mock import patch, MagicMock
import requests

@pytest.fixture
def proxy_client():
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    with app.app_context():
        db.create_all()
        admin = User(username="admin_proxy", role="admin", aktif=True)
        admin.set_password("pass123")
        db.session.add(admin)

        branch = Branch(
            nama="TM-Esports Belida",
            url="https://tm2billing.milannn.my.id",
            api_key="tmb_sec_belida_key_123",
            aktif=True
        )
        db.session.add(branch)
        db.session.commit()

        client = app.test_client()
        with client.session_transaction() as sess:
            sess['kasir_id'] = admin.id
            sess['kasir_username'] = admin.username
            sess['kasir_role'] = 'admin'
        yield client, branch.id
        db.session.remove()
        db.drop_all()

@patch('requests.request')
def test_proxy_relays_request_to_remote_branch(mock_req, proxy_client):
    client, branch_id = proxy_client
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.content = b'{"success": true, "pc_list": [{"nama": "PC-01"}]}'
    mock_resp.headers = {'Content-Type': 'application/json'}
    mock_req.return_value = mock_resp

    headers = {'X-Branch-ID': str(branch_id)}
    res = client.get('/api/v1/kasir/dashboard/pc', headers=headers)
    assert res.status_code == 200
    assert res.get_json()["pc_list"][0]["nama"] == "PC-01"

    # Verifikasi header Bearer Token dikirim ke target
    assert mock_req.called
    called_url = mock_req.call_args[1]["url"]
    called_headers = mock_req.call_args[1]["headers"]
    assert "https://tm2billing.milannn.my.id/api/v1/kasir/dashboard/pc" in called_url
    assert called_headers["Authorization"] == "Bearer tmb_sec_belida_key_123"

@patch('requests.request', side_effect=requests.exceptions.ConnectTimeout)
def test_proxy_handles_remote_offline_gracefully(mock_req, proxy_client):
    client, branch_id = proxy_client
    headers = {'X-Branch-ID': str(branch_id)}
    res = client.get('/api/v1/kasir/dashboard/pc', headers=headers)
    assert res.status_code in (503, 504)
    data = res.get_json()
    assert data["is_branch_offline"] is True
    assert "offline" in data["error"].lower()
