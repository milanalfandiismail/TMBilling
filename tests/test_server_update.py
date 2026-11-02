# tests/test_server_update.py
"""Unit tests untuk fitur Auto-Update Server & Migrasi (GitHub 1-Klik & Manual Upload)."""

import os
import io
import json
import zipfile
import pytest
from unittest.mock import patch, MagicMock
from app import create_app
from app.models import db, User, Sesi
from app.routes.settings.migration_routes import _parse_version
from install_scripts.extract_update import is_safe_path


@pytest.fixture
def app_context():
    app = create_app()
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["VERSION"] = "1.6.5-rc1"
    with app.app_context():
        db.create_all()
        admin = User(username="admin_test", nama_lengkap="Admin Test", role="admin")
        admin.set_password("admin123")
        db.session.add(admin)
        db.session.commit()

        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app_context):
    client = app_context.test_client()
    with client.session_transaction() as sess:
        sess["kasir_id"] = 1
        sess["kasir_role"] = "admin"
        sess["kasir_username"] = "admin_test"
    return client


def test_parse_version_semver():
    """Uji pembanding versi semver & release candidate."""
    assert _parse_version("v1.6.5-rc2") > _parse_version("v1.6.5-rc1")
    assert _parse_version("1.6.5") > _parse_version("1.6.5-rc2")
    assert _parse_version("v1.7.0") > _parse_version("1.6.5")
    assert _parse_version("1.6.5") == _parse_version("1.6.5")
    assert _parse_version("1.6.4") < _parse_version("1.6.5-rc1")


def test_is_safe_path_security():
    """Uji keamanan path traversal pada ekstraksi berkas update."""
    base = r"C:\TMBilling"
    assert is_safe_path(base, "run.py")
    assert is_safe_path(base, "app/routes/client.py")
    assert is_safe_path(base, "install_scripts/updater.bat")
    assert not is_safe_path(base, "../../../Windows/System32/cmd.exe")
    assert not is_safe_path(base, r"..\other_folder\script.bat")


def test_check_github_update_endpoint(client):
    """Uji endpoint /check_github dengan mock response GitHub API."""
    mock_github_response = {
        "tag_name": "v1.6.5-rc2",
        "name": "TMBilling Release v1.6.5-rc2",
        "body": "Perbaikan refund dan optimasi performa server.",
        "published_at": "2026-11-01T10:00:00Z",
        "assets": [
            {
                "name": "TMBilling_Server_v1.6.5-rc2.zip",
                "size": 3883848,
                "browser_download_url": "https://github.com/mock/TMBilling_Server_v1.6.5-rc2.zip",
            },
            {
                "name": "TMBilling_Client_v1.6.5-rc2.zip",
                "size": 11000000,
                "browser_download_url": "https://github.com/mock/TMBilling_Client_v1.6.5-rc2.zip",
            },
        ],
    }

    mock_resp = MagicMock()
    mock_resp.status = 200
    mock_resp.read.return_value = json.dumps(mock_github_response).encode("utf-8")
    mock_resp.__enter__.return_value = mock_resp

    with patch("urllib.request.urlopen", return_value=mock_resp):
        res = client.get("/api/v1/kasir/settings/migration/check_github")
        assert res.status_code == 200
        data = res.get_json()
        assert data["success"] is True
        assert data["is_newer"] is True
        assert data["latest_version"] == "v1.6.5-rc2"
        assert data["asset_name"] == "TMBilling_Server_v1.6.5-rc2.zip"
        assert data["asset_size"] == 3883848
        assert data["active_sessions_count"] == 0


def test_upload_update_invalid_zip_rejected(client):
    """Uji upload berkas ZIP yang tidak memiliki run.py dan app/ ditolak."""
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        zf.writestr("random.txt", "isi sembarangan")
    zip_buffer.seek(0)

    res = client.post(
        "/api/v1/kasir/settings/migration/upload",
        data={"update_file": (zip_buffer, "fake_update.zip")},
        content_type="multipart/form-data",
    )
    assert res.status_code == 400
    data = res.get_json()
    assert "bukan paket rilis TMBilling yang valid" in data["error"]


def test_upload_update_valid_zip_launches_updater(client):
    """Uji upload ZIP valid memicu runner updater.bat."""
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        zf.writestr("run.py", "# entry")
        zf.writestr("app/config.py", "# config")
    zip_buffer.seek(0)

    with patch("app.routes.settings.migration_routes._launch_updater") as mock_launch:
        res = client.post(
            "/api/v1/kasir/settings/migration/upload",
            data={"update_file": (zip_buffer, "valid_update.zip")},
            content_type="multipart/form-data",
        )
        assert res.status_code == 200
        data = res.get_json()
        assert data["success"] is True
        mock_launch.assert_called_once()


def test_update_github_launches_updater(client):
    """Uji endpoint update_github mengunduh zip dan memicu updater.bat."""
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        zf.writestr("run.py", "# entry")
        zf.writestr("app/config.py", "# config")
    zip_bytes = zip_buffer.getvalue()

    mock_resp = MagicMock()
    mock_resp.status = 200
    mock_resp.read.side_effect = [zip_bytes, b""]
    mock_resp.__enter__.return_value = mock_resp

    with patch("urllib.request.urlopen", return_value=mock_resp), \
         patch("app.routes.settings.migration_routes._launch_updater") as mock_launch:
        res = client.post(
            "/api/v1/kasir/settings/migration/update_github",
            data=json.dumps({"asset_url": "https://github.com/milanalfandiismail/TMBilling/releases/download/v1.6.5-rc2/TMBilling_Server_v1.6.5-rc2.zip"}),
            content_type="application/json",
        )
        assert res.status_code == 200
        data = res.get_json()
        assert data["success"] is True
        mock_launch.assert_called_once()


def test_check_github_update_counts_active_sessions_correctly(client, app_context):
    """Memastikan check_github menghitung sesi aktif dengan status lowercase 'aktif'."""
    with app_context.app_context():
        from app.models import PC, Grup, Sesi
        grup = Grup(nama="regular_update_test")
        db.session.add(grup)
        db.session.commit()
        pc = PC(kode="PC-TEST-99", ip_address="192.168.1.240", mac_address="AA:BB:CC:DD:EE:88", grup_id=grup.id)
        db.session.add(pc)
        db.session.commit()
        sesi = Sesi(pc_id=pc.id, status="aktif", tipe="postpaid")
        db.session.add(sesi)
        db.session.commit()

    mock_resp = MagicMock()
    mock_resp.status = 200
    mock_resp.read.return_value = json.dumps({
        "tag_name": "v1.6.5-rc2",
        "assets": []
    }).encode("utf-8")
    mock_resp.__enter__.return_value = mock_resp

    with patch("urllib.request.urlopen", return_value=mock_resp):
        res = client.get("/api/v1/kasir/settings/migration/check_github")
        assert res.status_code == 200
        data = res.get_json()
        assert data["active_sessions_count"] == 1


def test_update_github_rejects_ssrf_url(client):
    """Memastikan URL unduhan yang bukan berasal dari rilis GitHub resmi ditolak (anti-SSRF)."""
    malicious_urls = [
        "http://192.168.1.1/admin/reboot",
        "https://evil-site.com/fake_update.zip",
        "http://127.0.0.1:5000/api/v1/kasir/settings",
        "https://github.com/attacker/malicious_repo/releases/download/v1.0/update.zip",
    ]
    for bad_url in malicious_urls:
        res = client.post(
            "/api/v1/kasir/settings/migration/update_github",
            data=json.dumps({"asset_url": bad_url}),
            content_type="application/json"
        )
        assert res.status_code == 400
        data = res.get_json()
        assert "tidak diizinkan" in data["error"].lower()



