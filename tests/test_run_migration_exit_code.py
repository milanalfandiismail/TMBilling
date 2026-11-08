from contextlib import contextmanager

from sqlalchemy import create_engine

from install_scripts import run_migration


class _FakeDb:
    engine = create_engine("sqlite://")

    def create_all(self):
        pass


class _FakeApp:
    @contextmanager
    def app_context(self):
        yield


def test_run_migration_mengembalikan_false_saat_upgrade_gagal(monkeypatch, tmp_path):
    def gagal_upgrade(**kwargs):
        raise RuntimeError("migrasi rusak")

    monkeypatch.setattr("flask_migrate.upgrade", gagal_upgrade)
    monkeypatch.setattr(run_migration, "create_app", lambda: _FakeApp())
    monkeypatch.setattr(run_migration, "db", _FakeDb())

    assert run_migration.run() is False
