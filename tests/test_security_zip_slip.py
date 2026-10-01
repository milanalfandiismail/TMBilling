import io
import json
import pytest
from app import create_app


@pytest.fixture
def test_client():
    app = create_app()
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False

    with app.test_client() as client:
        with client.session_transaction() as sess:
            sess["kasir_id"] = 1
            sess["kasir_role"] = "admin"
            sess["kasir_username"] = "admin"
        yield app, client


def create_zip_in_memory(files_dict):
    """Buat file ZIP in-memory dari dictionary {filename: content}."""
    zip_buffer = io.BytesIO()
    import zipfile
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for fname, content in files_dict.items():
            zf.writestr(fname, content)
    zip_buffer.seek(0)
    return zip_buffer


def test_plugin_upload_rejects_zip_slip_traversal(test_client):
    app, client = test_client

    manifest_content = json.dumps({"id": "valid_plugin", "name": "Valid Plugin", "version": "1.0"})
    malicious_files = {
        "manifest.json": manifest_content,
        "../../evil.txt": "evil payload",
        "nested/../../../evil2.txt": "evil payload 2",
    }
    zip_buf = create_zip_in_memory(malicious_files)

    response = client.post(
        "/api/v1/kasir/settings/plugins/upload",
        data={"file": (zip_buf, "plugin.zip")},
        content_type="multipart/form-data",
    )

    assert response.status_code in [400, 500]
    data = response.get_json()
    assert data["success"] is False


def test_plugin_upload_rejects_malicious_plugin_id(test_client):
    app, client = test_client

    manifest_content = json.dumps({"id": "../evil_plugin", "name": "Evil", "version": "1.0"})
    files = {
        "manifest.json": manifest_content,
        "index.js": "console.log('hi');",
    }
    zip_buf = create_zip_in_memory(files)

    response = client.post(
        "/api/v1/kasir/settings/plugins/upload",
        data={"file": (zip_buf, "plugin.zip")},
        content_type="multipart/form-data",
    )

    assert response.status_code in [400, 500]
    data = response.get_json()
    assert data["success"] is False


def test_migration_upload_rejects_zip_slip_traversal(test_client):
    app, client = test_client

    malicious_files = {
        "run.py": "# valid run.py",
        "app/__init__.py": "# valid app init",
        "../../evil_migration.py": "evil code",
        "app/../../../evil_outside.py": "evil outside",
    }
    zip_buf = create_zip_in_memory(malicious_files)

    response = client.post(
        "/api/v1/kasir/settings/migration/upload",
        data={"update_file": (zip_buf, "update.zip")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data
