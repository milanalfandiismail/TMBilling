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


@pytest.fixture(autouse=True)
def cleanup_temp_update(app_context):
    from install_scripts import update_claim

    temp_zip = os.path.join(app_context.instance_path, "temp_update.zip")
    pending = temp_zip + ".pending"
    update_claim.release()
    for path in (temp_zip, pending):
        if os.path.exists(path):
            try:
                os.remove(path)
            except Exception:
                pass
    yield
    update_claim.release()
    for path in (temp_zip, pending):
        if os.path.exists(path):
            try:
                os.remove(path)
            except Exception:
                pass


def test_parse_version_semver():
    """Uji pembanding versi semver & release candidate."""
    assert _parse_version("v1.6.5-rc2") > _parse_version("v1.6.5-rc1")
    assert _parse_version("1.6.5") > _parse_version("1.6.5-rc2")
    assert _parse_version("v1.7.0") > _parse_version("1.6.5")
    assert _parse_version("1.6.5") == _parse_version("1.6.5")
    assert _parse_version("1.6.4") < _parse_version("1.6.5-rc1")


def test_backup_database_includes_wal(tmp_path, monkeypatch):
    """Backup pra-update harus menyertakan data yang masih di `-wal`."""
    import sqlite3
    from install_scripts import extract_update

    db_file = tmp_path / "warnet.db"
    conn = sqlite3.connect(db_file)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("CREATE TABLE t (v TEXT)")
    conn.execute("INSERT INTO t VALUES ('wal-data')")
    conn.commit()

    monkeypatch.setattr(extract_update, "db_path", str(db_file))
    monkeypatch.setattr(extract_update, "backups_dir", str(tmp_path / "backups"))
    assert extract_update.backup_database() is True
    conn.close()

    backup = next((tmp_path / "backups").glob("warnet_backup_before_update_*.db"))
    out = sqlite3.connect(backup)
    try:
        assert out.execute("SELECT v FROM t").fetchone()[0] == "wal-data"
    finally:
        out.close()


def test_extract_invalid_package_keeps_zip(tmp_path, monkeypatch):
    """ZIP tidak valid tidak boleh menghapus paket, agar bisa diperiksa/diulang."""
    from install_scripts import extract_update

    zip_path = tmp_path / "temp_update.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("random.txt", "bukan rilis TMBilling")

    monkeypatch.setattr(extract_update, "temp_zip", str(zip_path))
    monkeypatch.setattr(extract_update, "instance_dir", str(tmp_path))
    monkeypatch.setattr(extract_update, "db_path", str(tmp_path / "tidak_ada.db"))
    monkeypatch.setattr(extract_update, "backups_dir", str(tmp_path / "backups"))

    assert extract_update.main() == 1
    assert zip_path.exists()


def test_launch_updater_blocks_python_310(app_context):
    """Dashboard harus menolak memicu updater di Python < 3.11 dengan pesan jelas."""
    from app.routes.settings import migration_routes

    with app_context.app_context(), \
         patch("app.routes.settings.migration_routes.sys.version_info", (3, 10, 0)):
        with pytest.raises(RuntimeError, match="3.11"):
            migration_routes._launch_updater()


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
        zf.writestr("app/__init__.py", "# init")
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
        zf.writestr("app/__init__.py", "# init")
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


def _valid_zip():
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as zf:
        zf.writestr("run.py", "# entry")
        zf.writestr("app/config.py", "# config")
        zf.writestr("app/__init__.py", "# init")
    buffer.seek(0)
    return buffer


def test_concurrent_update_requests_rejected(client):
    """Request update kedua harus ditolak 409 dan tidak menimpa paket yang pertama."""
    with patch("app.routes.settings.migration_routes._launch_updater") as mock_launch:
        first = client.post(
            "/api/v1/kasir/settings/migration/upload",
            data={"update_file": (_valid_zip(), "satu.zip")},
            content_type="multipart/form-data",
        )
        assert first.status_code == 200
        temp_zip = os.path.join(client.application.instance_path, "temp_update.zip")
        isi_pertama = open(temp_zip, "rb").read()

        second = client.post(
            "/api/v1/kasir/settings/migration/upload",
            data={"update_file": (_valid_zip(), "dua.zip")},
            content_type="multipart/form-data",
        )
        assert second.status_code == 409
        assert mock_launch.call_count == 1
        assert open(temp_zip, "rb").read() == isi_pertama


def _journal_root(tmp_path):
    root = tmp_path / "root"
    instance = root / "instance"
    root.mkdir()
    instance.mkdir()
    return root, instance


def test_recover_interrupted_swap_restores_old_tree(tmp_path, monkeypatch):
    """Jurnal penukaran yang terputus harus mengembalikan pohon lama."""
    from install_scripts import extract_update

    root, instance = _journal_root(tmp_path)
    rollback = instance / "rollback_test"
    (rollback / "app").mkdir(parents=True)
    (rollback / "app" / "lama.txt").write_text("lama")
    (root / "app").mkdir()
    (root / "app" / "baru.txt").write_text("baru")
    journal = instance / "update_journal.json"
    journal.write_text(json.dumps({
        "rollback_dir": str(rollback),
        "staging_dir": str(instance / "staging_update"),
        "entries": [{"name": "app", "had_old": True, "old_moved": True, "new_installed": True}],
    }))

    monkeypatch.setattr(extract_update, "root_dir", str(root))
    monkeypatch.setattr(extract_update, "instance_dir", str(instance))
    monkeypatch.setattr(extract_update, "journal_path", str(journal))

    assert extract_update.recover_interrupted_swap() is True
    assert (root / "app" / "lama.txt").exists()
    assert not (root / "app" / "baru.txt").exists()
    assert not journal.exists()


def test_recover_interrupted_swap_removes_new_paths(tmp_path, monkeypatch):
    """Path yang sebelumnya tidak ada harus dihapus saat recovery."""
    from install_scripts import extract_update

    root, instance = _journal_root(tmp_path)
    rollback = instance / "rollback_test"
    rollback.mkdir()
    (root / "migrations").mkdir()
    (root / "migrations" / "baru.py").write_text("x")
    journal = instance / "update_journal.json"
    journal.write_text(json.dumps({
        "rollback_dir": str(rollback),
        "staging_dir": str(instance / "staging_update"),
        "entries": [{"name": "migrations", "had_old": False, "old_moved": False, "new_installed": True}],
    }))

    monkeypatch.setattr(extract_update, "root_dir", str(root))
    monkeypatch.setattr(extract_update, "instance_dir", str(instance))
    monkeypatch.setattr(extract_update, "journal_path", str(journal))

    assert extract_update.recover_interrupted_swap() is True
    assert not (root / "migrations").exists()


def test_recover_interrupted_swap_removes_new_path_after_replace_crash(tmp_path, monkeypatch):
    """Proses mati tepat setelah replace tetap harus dipulihkan dari jurnal."""
    from install_scripts import extract_update

    root, instance = _journal_root(tmp_path)
    staging = instance / "staging_update"
    (staging / "app").mkdir(parents=True)
    (staging / "app" / "baru.txt").write_text("baru")
    (staging / "migrations").mkdir()
    (staging / "migrations" / "001.py").write_text("x")
    (root / "app").mkdir()
    (root / "app" / "lama.txt").write_text("lama")

    monkeypatch.setattr(extract_update, "root_dir", str(root))
    monkeypatch.setattr(extract_update, "instance_dir", str(instance))
    monkeypatch.setattr(extract_update, "journal_path", str(instance / "update_journal.json"))

    real_replace = os.replace

    def crash_after_replace(src, dst):
        real_replace(src, dst)
        if os.path.basename(str(dst)) == "migrations":
            raise SystemExit("proses mati setelah replace")

    monkeypatch.setattr(extract_update.os, "replace", crash_after_replace)
    with pytest.raises(SystemExit):
        extract_update.swap_staging_into_tree(str(staging))
    assert (root / "migrations").exists()

    monkeypatch.setattr(extract_update.os, "replace", real_replace)
    assert extract_update.recover_interrupted_swap() is True
    assert not (root / "migrations").exists()
    assert (root / "app" / "lama.txt").exists()


def test_update_preserves_legacy_screenshots(tmp_path, monkeypatch):
    """Screenshot lama harus ikut selamat saat folder app/ diganti."""
    from install_scripts import extract_update
    from app.routes.monitor.screenshot_routes import migrate_legacy_screenshots

    root, instance = _journal_root(tmp_path)
    legacy_dir = root / "app" / "static" / "uploads" / "screenshots"
    legacy_dir.mkdir(parents=True)
    (legacy_dir / "PC-A.png").write_bytes(b"png-lama")
    (root / "app" / "lama.txt").write_text("lama")
    staging = instance / "staging_update"
    (staging / "app").mkdir(parents=True)
    (staging / "app" / "baru.txt").write_text("baru")

    monkeypatch.setattr(extract_update, "root_dir", str(root))
    monkeypatch.setattr(extract_update, "instance_dir", str(instance))
    monkeypatch.setattr(extract_update, "journal_path", str(instance / "update_journal.json"))

    extract_update.swap_staging_into_tree(str(staging))
    assert (root / "app" / "static" / "uploads" / "screenshots" / "PC-A.png").exists()

    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": "sqlite://",
        "INSTANCE_PATH": str(instance),
    })
    app.static_folder = str(root / "app" / "static")
    migrate_legacy_screenshots(app)

    private = instance / "uploads" / "screenshots" / "PC-A.png"
    assert private.exists()
    assert not (root / "app" / "static" / "uploads" / "screenshots" / "PC-A.png").exists()


def test_update_aborts_without_touching_live_tree_if_screenshot_copy_fails(tmp_path, monkeypatch):
    """Gagal menyalin screenshot harus membatalkan sebelum pohon live disentuh."""
    from install_scripts import extract_update

    root, instance = _journal_root(tmp_path)
    legacy_dir = root / "app" / "static" / "uploads" / "screenshots"
    legacy_dir.mkdir(parents=True)
    (legacy_dir / "PC-A.png").write_bytes(b"png-lama")
    (root / "app" / "lama.txt").write_text("lama")
    staging = instance / "staging_update"
    (staging / "app").mkdir(parents=True)
    (staging / "app" / "baru.txt").write_text("baru")

    monkeypatch.setattr(extract_update, "root_dir", str(root))
    monkeypatch.setattr(extract_update, "instance_dir", str(instance))
    monkeypatch.setattr(extract_update, "journal_path", str(instance / "update_journal.json"))
    monkeypatch.setattr(
        extract_update.shutil, "copy2",
        lambda *a, **k: (_ for _ in ()).throw(OSError("disk penuh")),
    )

    with pytest.raises(OSError):
        extract_update.swap_staging_into_tree(str(staging))

    assert (root / "app" / "lama.txt").exists()
    assert not (root / "app" / "baru.txt").exists()
    assert not (instance / "update_journal.json").exists()


def test_recover_interrupted_swap_fails_without_backup(tmp_path, monkeypatch):
    """Cadangan yang hilang harus dilaporkan gagal, bukan dianggap pulih."""
    from install_scripts import extract_update

    root, instance = _journal_root(tmp_path)
    rollback = instance / "rollback_test"
    rollback.mkdir()
    journal = instance / "update_journal.json"
    journal.write_text(json.dumps({
        "rollback_dir": str(rollback),
        "staging_dir": str(instance / "staging_update"),
        "entries": [{"name": "app", "had_old": True, "old_moved": True, "new_installed": True}],
    }))

    monkeypatch.setattr(extract_update, "root_dir", str(root))
    monkeypatch.setattr(extract_update, "instance_dir", str(instance))
    monkeypatch.setattr(extract_update, "journal_path", str(journal))

    assert extract_update.recover_interrupted_swap() is False
    assert journal.exists()



