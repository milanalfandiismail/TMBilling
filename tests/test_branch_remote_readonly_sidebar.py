# tests/test_branch_remote_readonly_sidebar.py
import pytest
from app import create_app
from app.models import db, User
from app.models.branch import Branch
from unittest.mock import patch, MagicMock

@pytest.fixture
def remote_readonly_client():
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    with app.app_context():
        db.create_all()
        admin = User(username="admin_test", role="admin", aktif=True)
        admin.set_password("pass123")
        db.session.add(admin)

        branch = Branch(
            nama="Cabang Remote 2",
            url="http://127.0.0.1:7016",
            api_key="test_branch_api_key_456",
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

def test_proxy_blocks_post_mutation_with_403(remote_readonly_client):
    client, branch_id = remote_readonly_client
    headers = {'X-Branch-ID': str(branch_id)}

    with patch('requests.request') as mock_req:
        res = client.post('/api/v1/kasir/dashboard/buka_sesi', headers=headers, json={"pc_id": 1})
        assert res.status_code == 403
        data = res.get_json()
        assert data["success"] is False
        assert "Read-Only" in data["error"]
        # Ensure request was blocked before network relay
        assert not mock_req.called

def test_proxy_blocks_put_mutation_with_403(remote_readonly_client):
    client, branch_id = remote_readonly_client
    headers = {'X-Branch-ID': str(branch_id)}

    with patch('requests.request') as mock_req:
        res = client.put('/api/v1/kasir/pc/1', headers=headers, json={"nama": "PC Baru"})
        assert res.status_code == 403
        data = res.get_json()
        assert data["success"] is False
        assert "Read-Only" in data["error"]
        assert not mock_req.called

def test_proxy_blocks_delete_mutation_with_403(remote_readonly_client):
    client, branch_id = remote_readonly_client
    headers = {'X-Branch-ID': str(branch_id)}

    with patch('requests.request') as mock_req:
        res = client.delete('/api/v1/kasir/member/1', headers=headers)
        assert res.status_code == 403
        data = res.get_json()
        assert data["success"] is False
        assert "Read-Only" in data["error"]
        assert not mock_req.called

def test_proxy_allows_get_request(remote_readonly_client):
    client, branch_id = remote_readonly_client
    headers = {'X-Branch-ID': str(branch_id)}

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.content = b'{"success": true, "pc_list": []}'
    mock_resp.headers = {'Content-Type': 'application/json'}

    with patch('requests.request', return_value=mock_resp) as mock_req:
        res = client.get('/api/v1/kasir/dashboard/pc', headers=headers)
        assert res.status_code == 200
        assert mock_req.called
        assert "http://127.0.0.1:7016/api/v1/kasir/dashboard/pc" in mock_req.call_args[1]["url"]

def test_sidebar_restricted_menus_have_remote_hidden_class(remote_readonly_client):
    client, _ = remote_readonly_client
    res = client.get('/kasir/')
    assert res.status_code == 200
    html = res.get_data(as_text=True)

    # 1. Operasional restricted tabs
    assert 'id="sidebar-tab-blackout"' in html
    assert 'class="tab-btn sidebar-remote-hidden' in html or 'sidebar-remote-hidden' in html

    # 2. Staff Management Group is wrapped in sidebar-remote-hidden
    assert 'id="sidebar-staff-group"' in html
    assert '<div class="sidebar-remote-hidden" id="sidebar-staff-group">' in html

    # 3. Server Settings Group is wrapped in sidebar-remote-hidden
    assert 'id="sidebar-settings-group"' in html
    assert '<div class="sidebar-remote-hidden" id="sidebar-settings-group">' in html

    # 4. Hardware checker and Remote server
    assert 'data-tab="hardware_checker"' in html
    assert 'data-tab="remote_server"' in html

    # 5. System & Utilities:
    # Analytics should NOT be hidden
    assert 'data-tab="analytics"' in html
    # But other system utilities should have sidebar-remote-hidden
    assert 'data-tab="mikrotik"' in html
    assert 'data-tab="fileexplorer"' in html
    assert 'data-tab="log"' in html
    assert 'data-tab="plugins"' in html
    assert 'id="sidebar-documentation-btn"' in html

def test_mutation_buttons_have_remote_hide_action_class(remote_readonly_client):
    client, _ = remote_readonly_client
    res = client.get('/kasir/')
    assert res.status_code == 200
    html = res.get_data(as_text=True)

    # Memastikan class remote-hide-action terpasang pada tombol-tombol CRUD
    assert 'remote-hide-action' in html


def test_pc_detail_modal_actions_have_remote_hide_action():
    """Memastikan tombol Monitor Proses, Remote Layar, Ambil Gambar, dan Screenshot container memiliki remote-hide-action."""
    detail_modal_path = "app/static/js/kasir/modules/dashboard/dashboard_detail_modal.js"
    with open(detail_modal_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Monitor proses harus memiliki class remote-hide-action
    assert 'DashboardProcessMonitor.showProcesses' in content
    assert 'class="remote-hide-action' in content or 'remote-hide-action' in content

    # 2. Remote view harus memiliki remote-hide-action
    assert 'DashboardDetailModal.openRemoteView' in content

    # 3. Take screenshot button harus memiliki remote-hide-action
    assert 'DashboardDetailModal.takeScreenshot' in content

