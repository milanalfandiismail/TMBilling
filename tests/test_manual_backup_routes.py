import pytest

from app import create_app
from app.models import db, User
from app.services import BackupService


@pytest.fixture()
def app(tmp_path):
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///" + str(tmp_path / "routes.db"),
        "WTF_CSRF_ENABLED": False,
    })
    with app.app_context():
        db.create_all()
        for nama, role in (("tadmin", "admin"), ("tkasir", "kasir")):
            u = User(username=nama, role=role, aktif=True)
            u.set_password("rahasia")
            db.session.add(u)
        db.session.commit()
    return app


def _masuk(app, nama, role):
    with app.app_context():
        uid = User.query.filter_by(username=nama).first().id
    client = app.test_client()
    with client.session_transaction() as sess:
        sess["kasir_id"] = uid
        sess["kasir_role"] = role
        sess["kasir_username"] = nama
    return client


def test_trigger_async_tanpa_membuat_backup(app, monkeypatch):
    dipanggil = []
    monkeypatch.setattr(BackupService, "start_manual", staticmethod(lambda *a, **k: (True, {"status": "running", "filename": None, "message": "Backup sedang berjalan"})))
    monkeypatch.setattr(BackupService, "create_backup", lambda self, report=None: dipanggil.append("create"))

    res = _masuk(app, "tadmin", "admin").post("/api/v1/kasir/backup/trigger")

    assert res.status_code == 202
    assert dipanggil == []


def test_trigger_menolak_job_ganda(app, monkeypatch):
    monkeypatch.setattr(BackupService, "start_manual", staticmethod(lambda *a, **k: (False, {"status": "running", "filename": None, "message": "Backup sedang berjalan"})))

    res = _masuk(app, "tadmin", "admin").post("/api/v1/kasir/backup/trigger")

    assert res.status_code == 409


def test_backup_manual_settings_async(app, monkeypatch):
    monkeypatch.setattr(BackupService, "start_manual", staticmethod(lambda *a, **k: (True, {"status": "running", "filename": None, "message": "Backup sedang berjalan"})))

    res = _masuk(app, "tadmin", "admin").post("/api/v1/kasir/settings/backup/manual")

    assert res.status_code == 202


def test_status_admin_saja(app, monkeypatch):
    monkeypatch.setattr(BackupService, "get_manual_status", staticmethod(lambda: {"status": "idle", "filename": None, "message": ""}))

    assert app.test_client().get("/api/v1/kasir/backup/manual/status").status_code == 401
    assert _masuk(app, "tkasir", "kasir").get("/api/v1/kasir/backup/manual/status").status_code == 403
    res = _masuk(app, "tadmin", "admin").get("/api/v1/kasir/backup/manual/status")
    assert res.status_code == 200
    assert res.get_json()["status"] == "idle"
