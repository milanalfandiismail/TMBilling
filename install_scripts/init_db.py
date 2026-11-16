"""Helper script: inisialisasi database (create_all tables)."""
import os
import sys

# Tambah root project ke path agar app module bisa ditemukan
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

from sqlalchemy import inspect

from app import bootstrap_app_data, create_app
from app.models.base.base import db


def _skema_lengkap():
    """True bila tabel inti sudah punya seluruh kolom yang dimiliki model."""
    from app.models import Member, PC, Sesi, Transaksi

    inspector = inspect(db.engine)
    for model in (Transaksi, Sesi, Member, PC):
        if not inspector.has_table(model.__tablename__):
            return False
        kolom = {c["name"] for c in inspector.get_columns(model.__tablename__)}
        if kolom != {c.name for c in model.__table__.columns}:
            return False
    return True


def init_database(app=None):
    app = app or create_app()
    with app.app_context():
        # Stamp hanya bila skema sudah identik dengan model; database lama yang
        # kolomnya tertinggal wajib lewat run_migration.py, bukan ditandai head.
        baru = not inspect(db.engine).has_table("alembic_version") and _skema_lengkap()
        if baru:
            db.create_all()
            from flask_migrate import stamp
            stamp(directory=os.path.join(PROJECT_ROOT, "migrations"), revision="head")
        else:
            print("[INFO] Database sudah ada; stamp dilewati. Jalankan run_migration.py untuk upgrade skema.")

        bootstrap_app_data(app)
        print("[OK] Tabel database berhasil diinisialisasi.")

        project_root = app.config.get("PROJECT_ROOT") or os.path.abspath(os.path.join(app.root_path, ".."))
        info_path = os.path.join(project_root, "initial_admin.txt")
        if os.path.exists(info_path):
            try:
                with open(info_path, "r", encoding="utf-8") as admin_file:
                    content = admin_file.read()
                print()
                print("=" * 50)
                print(content.strip())
                print("=" * 50)
                print()
            except OSError:
                pass


if __name__ == "__main__":
    init_database()
