"""Helper script: inisialisasi database (create_all tables)."""
import sys
import os

# Tambah root project ke path agar 'app' module bisa ditemukan
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.models.base import db

app = create_app()
with app.app_context():
    db.create_all()
    print('[OK] Tabel database berhasil diinisialisasi.')
