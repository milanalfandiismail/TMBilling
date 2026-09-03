# tests/test_branch_management_api.py
import pytest
from app import create_app
from app.models import db, User
from unittest.mock import patch, MagicMock

@pytest.fixture
def auth_client():
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
        yield client, app
        db.session.remove()
        db.drop_all()

def test_branch_my_key_endpoints(auth_client):
    client, app = auth_client
    res = client.get('/api/v1/kasir/branch/my-key')
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert "api_key" in data["data"]
    assert data["data"]["api_key"].startswith("tmb_sec_")

    # Test regenerate
    res_regen = client.post('/api/v1/kasir/branch/my-key/regenerate')
    assert res_regen.status_code == 200
    new_data = res_regen.get_json()
    assert new_data["data"]["api_key"] != data["data"]["api_key"]

@patch('requests.get')
def test_add_branch_with_auto_detect_name(mock_get, auth_client):
    client, app = auth_client
    # Mock auto-discovery warnet_title from remote branch
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "success": True,
        "data": {"warnet_title": "TM-Esports Belida Auto"}
    }
    mock_resp.elapsed.total_seconds.return_value = 0.045
    mock_get.return_value = mock_resp

    payload = {
        "url": "https://tm2billing.milannn.my.id",
        "api_key": "tmb_sec_remote_key_999"
    }
    res = client.post('/api/v1/kasir/branch/add', json=payload)
    assert res.status_code == 200
    res_json = res.get_json()
    assert res_json["success"] is True
    assert res_json["data"]["nama"] == "TM-Esports Belida Auto"
    assert res_json["data"]["url"] == "https://tm2billing.milannn.my.id"

    # Test list branches
    res_list = client.get('/api/v1/kasir/branch/list')
    assert res_list.status_code == 200
    list_json = res_list.get_json()
    assert list_json["success"] is True
    assert len(list_json["data"]) == 1
    assert list_json["data"][0]["nama"] == "TM-Esports Belida Auto"

    # Test update branch
    branch_id = res_json["data"]["id"]
    res_upd = client.put(f'/api/v1/kasir/branch/{branch_id}', json={"nama": "TM-Esports Belida Updated"})
    assert res_upd.status_code == 200
    assert res_upd.get_json()["data"]["nama"] == "TM-Esports Belida Updated"

    # Test test connection endpoint
    res_test = client.post('/api/v1/kasir/branch/test', json={"url": "https://tm2billing.milannn.my.id", "api_key": "tmb_sec_remote_key_999"})
    assert res_test.status_code == 200
    assert res_test.get_json()["data"]["online"] is True

    # Test delete branch
    res_del = client.delete(f'/api/v1/kasir/branch/{branch_id}')
    assert res_del.status_code == 200
    assert res_del.get_json()["success"] is True

    # Confirm list is empty
    res_list2 = client.get('/api/v1/kasir/branch/list')
    assert len(res_list2.get_json()["data"]) == 0
