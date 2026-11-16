"""Restore database menolak berjalan saat masih ada sesi bermain aktif."""
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
        u = User(username="tadmin", role="admin", aktif=True)
        u.set_password("rahasia")
        db.session.add(u)
        db.session.commit()
    return app


def _masuk(app):
    with app.app_context():
        uid = User.query.filter_by(username="tadmin").first().id
    client = app.test_client()
    with client.session_transaction() as sess:
        sess["kasir_id"] = uid
        sess["kasir_role"] = "admin"
        sess["kasir_username"] = "tadmin"
    return client


def _siapkan_zip(tmp_path, monkeypatch):
    (tmp_path / "warnet_backup_20260101_000000.zip").write_bytes(b"x")
    monkeypatch.setattr("app.routes.backup.backup_routes.default_backup_dir", lambda: str(tmp_path))
    monkeypatch.setattr(BackupService, "restore_backup",
                        lambda self, p: {"restored": "x", "safety_backup": "y"})


def test_restore_ditolak_saat_ada_sesi_aktif(app, tmp_path, monkeypatch):
    _siapkan_zip(tmp_path, monkeypatch)
    monkeypatch.setattr(
        "app.repositories.sesi.sesi_repository.SesiRepository.count_aktif",
        staticmethod(lambda: 3))
    res = _masuk(app).post(
        "/api/v1/kasir/backup/restore/warnet_backup_20260101_000000.zip",
        json={"confirm": True})
    assert res.status_code == 409
    assert res.get_json()["active_sessions"] == 3


def test_restore_lanjut_dengan_konfirmasi_eksplisit(app, tmp_path, monkeypatch):
    _siapkan_zip(tmp_path, monkeypatch)
    monkeypatch.setattr(
        "app.repositories.sesi.sesi_repository.SesiRepository.count_aktif",
        staticmethod(lambda: 2))
    res = _masuk(app).post(
        "/api/v1/kasir/backup/restore/warnet_backup_20260101_000000.zip",
        json={"confirm": True, "confirm_active_sessions": True})
    assert res.status_code == 200


def test_restore_tetap_jalan_saat_hitung_sesi_gagal(app, tmp_path, monkeypatch):
    _siapkan_zip(tmp_path, monkeypatch)

    def _rusak():
        raise RuntimeError("database tidak terbaca")

    monkeypatch.setattr(
        "app.repositories.sesi.sesi_repository.SesiRepository.count_aktif",
        staticmethod(_rusak))
    res = _masuk(app).post(
        "/api/v1/kasir/backup/restore/warnet_backup_20260101_000000.zip",
        json={"confirm": True})
    assert res.status_code == 200
