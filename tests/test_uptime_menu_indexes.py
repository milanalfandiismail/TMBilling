"""Index uptime dan log stok harus lahir dari model dan dari migrasi."""
from pathlib import Path

import pytest

from app import create_app, db

ROOT = Path(__file__).resolve().parents[1]
REVISI = ROOT / "migrations/versions/a2b3c4d5e6f7_add_uptime_and_stock_log_indexes.py"
NAMA_INDEX = (
    "ix_pc_uptime_log_tanggal",
    "ix_menu_stock_log_created_at",
    "ix_menu_stock_log_menu_id",
)


@pytest.fixture()
def aplikasi():
    app = create_app({"TESTING": True, "WTF_CSRF_ENABLED": False,
                      "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()


def test_index_terbentuk_dari_metadata(aplikasi):
    tabel = [r[0] for r in db.session.execute(db.text(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'ix_%'"))]
    for nama in NAMA_INDEX:
        assert nama in tabel, f"{nama} tidak terbentuk"


def test_revisi_migrasi_menyambung_kepala_dan_membuat_index():
    isi = REVISI.read_text(encoding="utf-8-sig")
    assert 'down_revision = "a1b2c3d4e5f6"' in isi
    for nama in NAMA_INDEX:
        assert f"CREATE INDEX IF NOT EXISTS {nama}" in isi
