"""Test siklus backup dan restore database SQLite (mode WAL)."""

import os
import shutil
import sqlite3
import zipfile

import pytest

from app import create_app
from app.models import db, Grup, User
from app.services.backup.backup_service import BackupService, default_backup_dir


@pytest.fixture
def backup_env(tmp_path):
    db_file = tmp_path / "warnet_backup_test.db"
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{db_file.as_posix()}",
    })
    with app.app_context():
        admin = User(username="admin_restore_test", password_hash="x", role="admin", aktif=True)
        kasir = User(username="kasir_restore_test", password_hash="x", role="kasir", aktif=True)
        db.session.add_all([Grup(nama="reguler"), admin, kasir])
        db.session.commit()
        yield app, db_file, tmp_path / "backups", admin.id, kasir.id
        db.session.remove()
        db.engine.dispose()


def _extract_db(zip_path, target):
    with zipfile.ZipFile(zip_path) as zf:
        names = zf.namelist()
        assert len(names) == 1
        with zf.open(names[0]) as src, open(target, "wb") as dst:
            shutil.copyfileobj(src, dst)
    return target


def test_backup_snapshot_includes_wal_data(backup_env, tmp_path):
    app, db_file, backup_dir, _admin_id, _kasir_id = backup_env
    with app.app_context():
        db.session.add(Grup(nama="wal-marker"))
        db.session.commit()
        # Data commit masih berada di -wal; backup naif (copy file .db) akan kehilangan ini.
        assert os.path.exists(str(db_file) + "-wal")

        zip_path = BackupService(backup_dir=str(backup_dir)).create_backup()

    con = sqlite3.connect(_extract_db(zip_path, tmp_path / "check.db"))
    try:
        rows = con.execute("SELECT nama FROM grup").fetchall()
    finally:
        con.close()
    assert ("wal-marker",) in rows


def test_restore_reverts_database_to_backup(backup_env):
    app, _db_file, backup_dir, _admin_id, _kasir_id = backup_env
    with app.app_context():
        db.session.add(Grup(nama="sebelum"))
        db.session.commit()

        service = BackupService(backup_dir=str(backup_dir))
        zip_path = service.create_backup()

        db.session.add(Grup(nama="sesudah"))
        db.session.commit()
        assert Grup.query.filter_by(nama="sesudah").first() is not None

        result = service.restore_backup(zip_path)

        assert result["restored"] == os.path.basename(zip_path)
        assert os.path.exists(os.path.join(str(backup_dir), result["safety_backup"]))
        assert Grup.query.filter_by(nama="sesudah").first() is None
        assert Grup.query.filter_by(nama="sebelum").first() is not None


def test_restore_rejects_corrupt_archive(backup_env):
    app, _db_file, backup_dir, _admin_id, _kasir_id = backup_env
    backup_dir.mkdir(parents=True, exist_ok=True)
    bad_zip = backup_dir / "warnet_backup_corrupt.zip"
    with zipfile.ZipFile(bad_zip, "w") as zf:
        zf.writestr("warnet.db", b"bukan database sqlite")

    with app.app_context():
        with pytest.raises(ValueError):
            BackupService(backup_dir=str(backup_dir)).restore_backup(str(bad_zip))


def test_restore_endpoint_requires_admin_and_confirmation(backup_env):
    app, _db_file, _backup_dir, admin_id, kasir_id = backup_env
    client = app.test_client()

    with client.session_transaction() as sess:
        sess["kasir_id"] = kasir_id
        sess["kasir_username"] = "kasir_restore_test"
        sess["kasir_role"] = "kasir"
    resp = client.post("/api/v1/kasir/backup/restore/x.zip", json={"confirm": True})
    assert resp.status_code == 403

    with client.session_transaction() as sess:
        sess["kasir_id"] = admin_id
        sess["kasir_role"] = "admin"
    resp = client.post("/api/v1/kasir/backup/restore/warnet_backup_x.zip", json={})
    assert resp.status_code == 400


def test_default_backup_dir_prefers_env_override(monkeypatch, tmp_path):
    target = tmp_path / "isolated_backups"
    monkeypatch.setenv("BACKUP_DIR", str(target))
    assert default_backup_dir() == os.path.abspath(str(target))


def test_backup_missing_database_raises(tmp_path):
    with pytest.raises(RuntimeError, match="Database tidak ditemukan"):
        BackupService(db_path=str(tmp_path / "tidak_ada.db"), backup_dir=str(tmp_path / "b")).create_backup()


def test_restore_rejects_archive_without_database(backup_env):
    app, _db_file, backup_dir, _a, _k = backup_env
    backup_dir.mkdir(parents=True, exist_ok=True)
    arsip = backup_dir / "warnet_backup_tanpa_db.zip"
    with zipfile.ZipFile(arsip, "w") as zf:
        zf.writestr("readme.txt", "bukan database")
    with app.app_context(), pytest.raises(ValueError, match="tidak berisi file database"):
        BackupService(backup_dir=str(backup_dir)).restore_backup(str(arsip))


def test_restore_rejects_corrupt_sqlite_payload(backup_env):
    app, _db_file, backup_dir, _a, _k = backup_env
    backup_dir.mkdir(parents=True, exist_ok=True)
    arsip = backup_dir / "warnet_backup_rusak.zip"
    with zipfile.ZipFile(arsip, "w") as zf:
        zf.writestr("warnet.db", b"SQLite format 3\x00" + b"\x00" * 256)
    with app.app_context(), pytest.raises(ValueError, match="integrity_check"):
        BackupService(backup_dir=str(backup_dir)).restore_backup(str(arsip))


def test_backup_archive_contains_single_db_member(backup_env):
    app, db_file, backup_dir, _a, _k = backup_env
    with app.app_context():
        zip_path = BackupService(backup_dir=str(backup_dir)).create_backup()
    with zipfile.ZipFile(zip_path) as zf:
        assert zf.namelist() == [db_file.name]


def test_cleanup_keeps_newest_five(backup_env):
    app, _db_file, backup_dir, _a, _k = backup_env
    backup_dir.mkdir(parents=True, exist_ok=True)
    for i in range(7):
        path = backup_dir / f"warnet_backup_2026010{i}_000000.zip"
        path.write_bytes(b"x")
        os.utime(path, (1_700_000_000 + i, 1_700_000_000 + i))
    with app.app_context():
        BackupService(backup_dir=str(backup_dir)).cleanup_old_backups(max_keep=5)
    tersisa = sorted(p.name for p in backup_dir.glob("warnet_backup_*.zip"))
    assert len(tersisa) == 5
    assert "warnet_backup_20260100_000000.zip" not in tersisa
    assert "warnet_backup_20260101_000000.zip" not in tersisa


def test_database_writable_after_restore(backup_env):
    app, _db_file, backup_dir, _a, _k = backup_env
    with app.app_context():
        service = BackupService(backup_dir=str(backup_dir))
        zip_path = service.create_backup()
        service.restore_backup(zip_path)
        db.session.add(Grup(nama="setelah-restore"))
        db.session.commit()
        assert Grup.query.filter_by(nama="setelah-restore").first() is not None


def _admin_session(client, admin_id):
    with client.session_transaction() as sess:
        sess["kasir_id"] = admin_id
        sess["kasir_username"] = "admin_restore_test"
        sess["kasir_role"] = "admin"


def test_api_menolak_selama_maintenance(backup_env):
    app, *_ = backup_env
    from app.services import maintenance_mode
    c = app.test_client()
    with maintenance_mode.restoring():
        assert c.get("/api/v1/kasir/settings/").status_code == 503
        assert c.get("/api/health").status_code == 200
    assert maintenance_mode.is_active() is False


def test_restore_endpoint_happy_path(backup_env, monkeypatch):
    app, _db_file, backup_dir, admin_id, _k = backup_env
    monkeypatch.setenv("BACKUP_DIR", str(backup_dir))
    with app.app_context():
        arsip = BackupService(backup_dir=str(backup_dir)).create_backup()
        db.session.add(Grup(nama="hilang-setelah-restore"))
        db.session.commit()
        nama = os.path.basename(arsip)

    client = app.test_client()
    _admin_session(client, admin_id)
    resp = client.post(f"/api/v1/kasir/backup/restore/{nama}", json={"confirm": True})
    assert resp.status_code == 200, resp.get_data(as_text=True)
    body = resp.get_json()
    assert body["restored"] == nama
    assert os.path.exists(os.path.join(str(backup_dir), body["safety_backup"]))
    with app.app_context():
        assert Grup.query.filter_by(nama="hilang-setelah-restore").first() is None


def test_restore_endpoint_missing_file_404(backup_env, monkeypatch):
    app, _db_file, backup_dir, admin_id, _k = backup_env
    monkeypatch.setenv("BACKUP_DIR", str(backup_dir))
    client = app.test_client()
    _admin_session(client, admin_id)
    resp = client.post("/api/v1/kasir/backup/restore/warnet_backup_tidak_ada.zip", json={"confirm": True})
    assert resp.status_code == 404


def test_restore_endpoint_rejects_path_traversal(backup_env, monkeypatch):
    app, _db_file, backup_dir, admin_id, _k = backup_env
    monkeypatch.setenv("BACKUP_DIR", str(backup_dir))
    client = app.test_client()
    _admin_session(client, admin_id)
    resp = client.post("/api/v1/kasir/backup/restore/..%5Cevil.zip", json={"confirm": True})
    assert resp.status_code == 400


def test_restore_endpoint_requires_zip_extension(backup_env, monkeypatch):
    app, _db_file, backup_dir, admin_id, _k = backup_env
    monkeypatch.setenv("BACKUP_DIR", str(backup_dir))
    backup_dir.mkdir(parents=True, exist_ok=True)
    (backup_dir / "catatan.txt").write_text("bukan zip")
    client = app.test_client()
    _admin_session(client, admin_id)
    resp = client.post("/api/v1/kasir/backup/restore/catatan.txt", json={"confirm": True})
    assert resp.status_code == 400


def test_backup_list_admin_and_forbidden_for_kasir(backup_env, monkeypatch):
    app, _db_file, backup_dir, admin_id, kasir_id = backup_env
    monkeypatch.setenv("BACKUP_DIR", str(backup_dir))
    with app.app_context():
        nama = os.path.basename(BackupService(backup_dir=str(backup_dir)).create_backup())
    client = app.test_client()
    _admin_session(client, admin_id)
    resp = client.get("/api/v1/kasir/backup/list")
    assert resp.status_code == 200
    assert nama in [b["filename"] for b in resp.get_json()["backups"]]

    with client.session_transaction() as sess:
        sess["kasir_id"] = kasir_id
        sess["kasir_role"] = "kasir"
    assert client.get("/api/v1/kasir/backup/list").status_code == 403


def test_maintenance_mode_stays_active_for_overlapping_restores():
    """Restore yang tumpang tindih tidak boleh membuka gerbang lebih awal."""
    from app.services import maintenance_mode

    with maintenance_mode.restoring():
        with maintenance_mode.restoring():
            pass
        assert maintenance_mode.is_active() is True
    assert maintenance_mode.is_active() is False


def _versioned_backup(backup_env, revision="deadbeefcafe"):
    """Buat arsip backup yang menyertakan tabel revisi Alembic (DB produksi)."""
    app, db_file, backup_dir, _a, _k = backup_env
    con = sqlite3.connect(str(db_file))
    try:
        con.execute("CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL)")
        con.execute("DELETE FROM alembic_version")
        con.execute("INSERT INTO alembic_version VALUES (?)", (revision,))
        con.commit()
    finally:
        con.close()
    with app.app_context():
        return BackupService(backup_dir=str(backup_dir)).create_backup()


def test_restore_migrates_versioned_backup(backup_env, monkeypatch):
    from install_scripts import run_migration

    app, _db_file, backup_dir, _a, _k = backup_env
    arsip = _versioned_backup(backup_env)
    dipanggil = {}

    def fake_run(app_arg=None):
        dipanggil["app"] = app_arg
        return True

    monkeypatch.setattr(run_migration, "run", fake_run)
    with app.app_context():
        BackupService(backup_dir=str(backup_dir)).restore_backup(arsip)

    assert dipanggil["app"] is app


def test_restore_rolls_back_when_migration_fails(backup_env, monkeypatch):
    from install_scripts import run_migration

    app, _db_file, backup_dir, _a, _k = backup_env
    arsip = _versioned_backup(backup_env)
    with app.app_context():
        db.session.add(Grup(nama="penanda-sebelum-restore"))
        db.session.commit()

    monkeypatch.setattr(run_migration, "run", lambda app=None: False)
    with app.app_context(), pytest.raises(ValueError, match="dikembalikan"):
        BackupService(backup_dir=str(backup_dir)).restore_backup(arsip)

    assert Grup.query.filter_by(nama="penanda-sebelum-restore").first() is not None


def test_restore_skips_migration_for_unversioned_backup(backup_env, monkeypatch):
    from install_scripts import run_migration

    app, _db_file, backup_dir, _a, _k = backup_env
    with app.app_context():
        arsip = BackupService(backup_dir=str(backup_dir)).create_backup()

    monkeypatch.setattr(run_migration, "run", lambda app=None: pytest.fail("migrasi tidak boleh dijalankan"))
    with app.app_context():
        BackupService(backup_dir=str(backup_dir)).restore_backup(arsip)
