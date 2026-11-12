"""Helper script: inisialisasi database (create_all tables)."""
import sys
import os

# Tambah root project ke path agar 'app' module bisa ditemukan
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app import bootstrap_app_data
from app.models.base.base import db

app = create_app()
with app.app_context():
    db.create_all()
    # Skema dibuat langsung dari model, jadi revisi di-stamp head agar
    # `flask db upgrade` berikutnya tidak memutar ulang migrasi lama.
    from flask_migrate import stamp
    stamp(
        directory=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "migrations"),
        revision="head",
    )
    bootstrap_app_data(app)
    print('[OK] Tabel database berhasil diinisialisasi.')

    project_root = app.config.get("PROJECT_ROOT") or os.path.abspath(os.path.join(app.root_path, ".."))
    info_path = os.path.join(project_root, "initial_admin.txt")
    if os.path.exists(info_path):
        try:
            with open(info_path, "r", encoding="utf-8") as f:
                content = f.read()
            print("\n" + "=" * 50)
            print(content.strip())
            print("=" * 50 + "\n")
        except Exception:
            pass
