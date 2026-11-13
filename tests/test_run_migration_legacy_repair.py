import sqlite3

from sqlalchemy import inspect, text

from app import create_app, db


def _app(tmp_path, db_name):
    instance = tmp_path / "instance"
    instance.mkdir(exist_ok=True)
    return create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///" + (tmp_path / db_name).as_posix(),
        "INSTANCE_PATH": str(instance),
        "PROJECT_ROOT": str(tmp_path),
    })


def _legacy_without_alembic(tmp_path, db_name="legacy_repair.db"):
    path = tmp_path / db_name
    conn = sqlite3.connect(path)
    conn.execute(
        "CREATE TABLE transaksi (id INTEGER PRIMARY KEY, no_nota VARCHAR(50), jumlah INTEGER DEFAULT 0)"
    )
    conn.execute(
        "CREATE TABLE transaksi_menu (id INTEGER PRIMARY KEY, no_nota VARCHAR(50), total_harga INTEGER DEFAULT 0)"
    )
    conn.execute("CREATE TABLE hardware_monitor (id INTEGER PRIMARY KEY, pc_id INTEGER)")
    conn.execute("INSERT INTO transaksi (id, no_nota, jumlah) VALUES (1, 'TM-1', 5000)")
    conn.commit()
    conn.close()
    return path


def test_repair_legacy_menambah_semua_kolom_dan_backfill(tmp_path):
    from install_scripts.run_migration import run as run_migration

    _legacy_without_alembic(tmp_path)
    app = _app(tmp_path, "legacy_repair.db")

    with app.app_context():
        assert run_migration(app) is True
        inspector = inspect(db.engine)

        transaksi_cols = {c["name"] for c in inspector.get_columns("transaksi")}
        assert {"metode_pembayaran", "operator"} <= transaksi_cols

        menu_cols = {c["name"] for c in inspector.get_columns("transaksi_menu")}
        assert {"metode_pembayaran", "operator", "tunai", "kembalian"} <= menu_cols

        hw_cols = {c["name"] for c in inspector.get_columns("hardware_monitor")}
        assert {"hardware_baseline", "hardware_current_specs", "hardware_last_sync"} <= hw_cols

        with db.engine.connect() as conn:
            metode = conn.execute(
                text("SELECT metode_pembayaran FROM transaksi WHERE id = 1")
            ).scalar()
            revision = conn.execute(
                text("SELECT version_num FROM alembic_version")
            ).scalar()
        assert metode == "Tunai"
        assert revision == "a1b2c3d4e5f6"


def test_repair_legacy_idempoten(tmp_path):
    from install_scripts.run_migration import run as run_migration

    _legacy_without_alembic(tmp_path)
    app = _app(tmp_path, "legacy_repair.db")

    with app.app_context():
        assert run_migration(app) is True
        assert run_migration(app) is True
