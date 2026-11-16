import sqlite3

from sqlalchemy import inspect, text

from app import create_app
from app.models.base.base import db


def _app(tmp_path, sql_awal=None):
    if sql_awal:
        con = sqlite3.connect(tmp_path / "db.sqlite")
        con.executescript(sql_awal)
        con.commit()
        con.close()
    return create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///" + str(tmp_path / "db.sqlite"),
        }
    )


def test_database_baru_distamp_head(tmp_path):
    from install_scripts.init_db import init_database

    app = _app(tmp_path)
    init_database(app)
    with app.app_context():
        assert inspect(db.engine).has_table("alembic_version")
        versi = db.session.execute(text("SELECT version_num FROM alembic_version")).scalar()
        assert versi


def test_database_lama_beralembic_tidak_distamp_ulang(tmp_path):
    from install_scripts.init_db import init_database

    sql = "CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL);"
    app = _app(tmp_path, sql)
    with app.app_context():
        db.session.execute(text("INSERT INTO alembic_version VALUES (:v)"), {"v": "lama123"})
        db.session.commit()
    init_database(app)
    with app.app_context():
        versi = db.session.execute(text("SELECT version_num FROM alembic_version")).scalar()
        assert versi == "lama123"


def test_database_lama_kolom_tertinggal_tidak_distamp(tmp_path):
    from install_scripts.init_db import init_database

    app = _app(tmp_path, "CREATE TABLE transaksi (id INTEGER PRIMARY KEY);")
    init_database(app)
    with app.app_context():
        kolom = {c["name"] for c in inspect(db.engine).get_columns("transaksi")}
        assert kolom == {"id"}
        assert not inspect(db.engine).has_table("alembic_version")


def test_init_database_dua_kali_tetap_aman(tmp_path):
    from install_scripts.init_db import init_database

    app = _app(tmp_path)
    init_database(app)
    init_database(app)
    with app.app_context():
        assert inspect(db.engine).has_table("alembic_version")
