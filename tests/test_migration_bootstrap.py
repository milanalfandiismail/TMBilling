import os
import sqlite3

from sqlalchemy import inspect, text

from app import create_app, db

MIGRATIONS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "migrations")
)


def _app(tmp_path, db_name):
    instance = tmp_path / "instance"
    instance.mkdir(exist_ok=True)
    return create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{(tmp_path / db_name).as_posix()}",
        "INSTANCE_PATH": str(instance),
        "PROJECT_ROOT": str(tmp_path),
    })


def _legacy_db(tmp_path, db_name, revision=None):
    path = tmp_path / db_name
    conn = sqlite3.connect(path)
    conn.execute("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)")
    if revision:
        conn.execute("INSERT INTO alembic_version (version_num) VALUES (?)", (revision,))
    conn.commit()
    conn.close()
    return path


def test_db_baru_disiapkan_otomatis(tmp_path):
    app = _app(tmp_path, "fresh.db")

    with app.app_context():
        inspector = inspect(db.engine)
        assert inspector.has_table("user")
        assert inspector.has_table("maintenance_ticket")


def test_create_app_tidak_membuat_skema_pada_db_ber_alembic(tmp_path):
    _legacy_db(tmp_path, "legacy_guard.db", revision="70637ae29f36")
    app = _app(tmp_path, "legacy_guard.db")

    with app.app_context():
        inspector = inspect(db.engine)
        assert not inspector.has_table("user")
        assert not inspector.has_table("maintenance_ticket")


def test_legacy_revision_can_create_maintenance_ticket(tmp_path):
    from flask_migrate import upgrade

    _legacy_db(tmp_path, "legacy.db", revision="70637ae29f36")
    app = _app(tmp_path, "legacy.db")

    with app.app_context():
        assert not inspect(db.engine).has_table("maintenance_ticket")

        upgrade(directory=MIGRATIONS_DIR, revision="05864b2cbb33")

        assert inspect(db.engine).has_table("maintenance_ticket")
