# tests/test_branch_switch_connectivity.py
"""Unit and integration tests for preventing switching to unreachable/offline branch."""

import pytest
from unittest.mock import patch, MagicMock
from app import create_app
from app.models import db, User
from app.models.branch import Branch
import requests


@pytest.fixture
def test_client():
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    with app.app_context():
        db.create_all()
        admin = User(username="admin_test", role="admin", aktif=True)
        admin.set_password("pass123")
        db.session.add(admin)

        branch_online = Branch(
            nama="Cabang Sukses",
            url="https://branch1.test.id",
            api_key="tmb_key_1",
            aktif=True,
            status_online=True
        )
        branch_offline = Branch(
            nama="Cabang Rusak",
            url="https://branch2.test.id",
            api_key="tmb_key_2",
            aktif=True,
            status_online=False
        )
        db.session.add_all([branch_online, branch_offline])
        db.session.commit()

        client = app.test_client()
        with client.session_transaction() as sess:
            sess['kasir_id'] = admin.id
            sess['kasir_username'] = admin.username
            sess['kasir_role'] = 'admin'

        yield client, branch_online.id, branch_offline.id
        db.session.remove()
        db.drop_all()


def test_switch_to_local_branch_always_succeeds(test_client):
    client, b_online_id, _ = test_client
    # Set session remote terlebih dahulu
    with client.session_transaction() as sess:
        sess['active_branch_id'] = b_online_id
        sess['active_branch_name'] = "Cabang Sukses"

    res = client.post('/api/v1/kasir/branch/switch-context', json={"branch_id": 0})
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["data"]["active_branch_id"] == 0
    assert data["data"]["is_remote"] is False

    with client.session_transaction() as sess:
        assert sess.get('active_branch_id') is None


@patch('app.services.branch.branch_service.requests.get')
def test_switch_to_remote_branch_succeeds_when_online(mock_get, test_client):
    client, b_online_id, _ = test_client
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"success": True, "data": {"warnet_title": "Cabang Sukses"}}
    mock_get.return_value = mock_resp

    res = client.post('/api/v1/kasir/branch/switch-context', json={"branch_id": b_online_id})
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["data"]["active_branch_id"] == b_online_id
    assert data["data"]["branch_name"] == "Cabang Sukses"

    with client.session_transaction() as sess:
        assert sess.get('active_branch_id') == b_online_id


@patch('app.services.branch.branch_service.requests.get', side_effect=requests.exceptions.ConnectTimeout)
def test_switch_to_remote_branch_rejected_when_offline(mock_get, test_client):
    client, _, b_offline_id = test_client
    res = client.post('/api/v1/kasir/branch/switch-context', json={"branch_id": b_offline_id})
    assert res.status_code == 400
    data = res.get_json()
    assert data["success"] is False
    assert data.get("is_offline") is True
    assert "tidak dapat terhubung" in data["error"].lower()

    # Pastikan session TIDAK terisi branch_id yang offline
    with client.session_transaction() as sess:
        assert sess.get('active_branch_id') is None


@patch('app.services.branch.branch_service.requests.get')
def test_dedicated_branch_test_endpoint_updates_db(mock_get, test_client):
    client, _, b_offline_id = test_client
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"success": True, "data": {"warnet_title": "Cabang Pulih"}}
    mock_get.return_value = mock_resp

    res = client.post(f'/api/v1/kasir/branch/{b_offline_id}/test')
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["data"]["online"] is True
