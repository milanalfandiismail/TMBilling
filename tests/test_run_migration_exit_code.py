from contextlib import contextmanager

from sqlalchemy import create_engine

from install_scripts import run_migration


class _FakeDb:
    engine = create_engine("sqlite://")

    def create_all(self):
        pass


class _FailingSyncDb(_FakeDb):
    def create_all(self):
        raise RuntimeError("safety sync rusak")


class _FakeApp:
    @contextmanager
    def app_context(self):
        yield


def test_run_migration_mengembalikan_false_saat_upgrade_gagal(monkeypatch, tmp_path):
    stamped = []

    def gagal_upgrade(**kwargs):
        raise RuntimeError("migrasi rusak")

    monkeypatch.setattr("flask_migrate.upgrade", gagal_upgrade)
    monkeypatch.setattr("flask_migrate.stamp", lambda **kw: stamped.append(kw.get("revision")))
    monkeypatch.setattr(run_migration, "create_app", lambda: _FakeApp())
    monkeypatch.setattr(run_migration, "db", _FakeDb())

    assert run_migration.run() is False
    assert "head" not in stamped


def test_run_migration_tidak_stamp_head_saat_safety_sync_gagal(monkeypatch, tmp_path):
    stamped = []

    monkeypatch.setattr("flask_migrate.upgrade", lambda **kwargs: None)
    monkeypatch.setattr("flask_migrate.stamp", lambda **kw: stamped.append(kw.get("revision")))
    monkeypatch.setattr(run_migration, "create_app", lambda: _FakeApp())
    monkeypatch.setattr(run_migration, "db", _FailingSyncDb())

    assert run_migration.run() is False
    assert "head" not in stamped
