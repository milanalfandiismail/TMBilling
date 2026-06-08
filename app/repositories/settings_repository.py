# app/repositories/settings_repository.py

"""Repository untuk entitas Settings.

Modul ini mengelola konfigurasi aplikasi yang disimpan di database,
memungkinkan perubahan parameter sistem tanpa harus mengubah kode.
"""

from app.models.base import db
from app.models.settings import Settings


class SettingsRepository:
    """Repository class untuk mengelola konfigurasi sistem."""

    # =========================================================================
    # 1. PENGAMBILAN KONFIGURASI (READ)
    # =========================================================================
    # Fokus: Mengambil nilai pengaturan berdasarkan kunci tertentu.

    @staticmethod
    def get(key, default=None):
        """Mengambil nilai setting berdasarkan key (dengan default fallback)."""
        s = Settings.query.filter_by(key=key).first()
        return s.value if s else default

    @staticmethod
    def get_all():
        """Mengambil semua setting dan mengembalikannya dalam bentuk Dictionary."""
        return {s.key: s.value for s in Settings.query.all()}


    # =========================================================================
    # 2. PERUBAHAN KONFIGURASI (WRITE)
    # =========================================================================
    # Fokus: Mengubah atau menambah nilai pengaturan baru.

    @staticmethod
    def save(setting):
        """Menyimpan setting (Tanpa Commit)."""
        db.session.add(setting)

    @staticmethod
    def set(key, value):
        """Menyimpan atau memperbarui nilai setting berdasarkan key."""
        s = Settings.query.filter_by(key=key).first()
        if s:
            s.value = str(value)
        else:
            s = Settings(key=key, value=str(value))
            db.session.add(s)