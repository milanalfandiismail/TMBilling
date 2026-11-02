"""Helper script: inisialisasi database (create_all tables)."""
import sys
import os

# Tambah root project ke path agar 'app' module bisa ditemukan
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.models.base.base import db

app = create_app()
with app.app_context():
    db.create_all()
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
