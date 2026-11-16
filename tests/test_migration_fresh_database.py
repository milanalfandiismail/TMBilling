"""Pagar migrasi: jalur resmi run_migration harus menghasilkan skema = model."""

import importlib.util
from pathlib import Path

import pytest
from sqlalchemy import inspect

from app import create_app, db

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "tmbilling_run_migration", ROOT / "install_scripts" / "run_migration.py"
)


def _run_migration_module():
    module = importlib.util.module_from_spec(SPEC)
    SPEC.loader.exec_module(module)
    return module


@pytest.fixture()
def fresh_app(tmp_path):
    uri = "sqlite:///" + str(tmp_path / "fresh.db").replace("\\", "/")
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": uri,
    })
    with app.app_context():
        # Skema dibuat model tanpa rev Alembic: kondisi database lama sebelum upgrade.
        db.create_all()
        yield app
        db.session.remove()
        db.engine.dispose()


def test_run_migration_menyamakan_skema_dengan_model(fresh_app):
    run_migration = _run_migration_module()
    with fresh_app.app_context():
        assert run_migration.run(fresh_app) is True

        insp = inspect(db.engine)
        tabel_db = {t for t in insp.get_table_names() if t != "alembic_version"}
        tabel_model = {t.name for t in db.metadata.sorted_tables}
        assert tabel_db == tabel_model

        selisih = []
        for tabel in sorted(tabel_model):
            kolom_db = {c["name"] for c in insp.get_columns(tabel)}
            kolom_model = {c.name for c in db.metadata.tables[tabel].columns}
            if kolom_db != kolom_model:
                selisih.append(f"{tabel}: kurang={sorted(kolom_model - kolom_db)} lebih={sorted(kolom_db - kolom_model)}")
        assert not selisih, "Kolom tidak sinkron setelah migrasi:\n" + "\n".join(selisih)

        assert insp.has_table("alembic_version")
