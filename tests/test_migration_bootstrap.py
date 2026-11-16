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


def test_run_migration_setelah_create_all_tidak_gagal_duplicate_column(tmp_path):
    from install_scripts.run_migration import run as run_migration

    app = _app(tmp_path, "fresh_migrate.db")

    with app.app_context():
        assert run_migration(app) is True
        inspector = inspect(db.engine)
        cols = [c["name"] for c in inspector.get_columns("transaksi")]
        assert "operator" in cols


def test_run_migration_memasang_index_rc2_pada_db_create_all(tmp_path):
    from install_scripts.run_migration import run as run_migration

    names = (
        "uq_aktif_shift", "uq_aktif_sesi_pc", "uq_aktif_sesi_member",
        "ix_transaksi_menu_tanggal", "ix_transaksi_member_id",
        "ix_transaksi_user_id", "ix_sesi_mulai_pada",
    )
    app = _app(tmp_path, "fresh_index.db")

    with app.app_context():
        with db.engine.connect() as conn:
            for name in names:
                conn.execute(text(f"DROP INDEX IF EXISTS {name}"))
            conn.commit()

        assert run_migration(app) is True

        with db.engine.connect() as conn:
            ada = {r[0] for r in conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='index'"))}
        assert set(names) <= ada


def test_legacy_revision_can_create_maintenance_ticket(tmp_path):
    from flask_migrate import upgrade

    _legacy_db(tmp_path, "legacy.db", revision="70637ae29f36")
    app = _app(tmp_path, "legacy.db")

    with app.app_context():
        assert not inspect(db.engine).has_table("maintenance_ticket")

        upgrade(directory=MIGRATIONS_DIR, revision="05864b2cbb33")

        assert inspect(db.engine).has_table("maintenance_ticket")
