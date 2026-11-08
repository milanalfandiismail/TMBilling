import pytest
from sqlalchemy import text
from app import create_app
from app.models import db


@pytest.fixture
def app_ctx():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove(); db.drop_all()


def test_index_unik_sesi_aktif_ada_setelah_create_all(app_ctx):
    rows = db.session.execute(text("PRAGMA index_list('sesi')")).fetchall()
    names = {r[1] for r in rows}
    assert "uq_aktif_sesi_pc" in names


def test_migrasi_index_baru_punya_head_tunggal():
    from alembic.config import Config
    from alembic.script import ScriptDirectory
    cfg = Config("migrations/alembic.ini")
    cfg.set_main_option("script_location", "migrations")
    script = ScriptDirectory.from_config(cfg)
    assert script.get_heads() == ["e5f6a7b8c9d0"]
