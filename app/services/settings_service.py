# app/services/settings_service.py

"""Service untuk manajemen pengaturan sistem.

Modul ini menyediakan interface untuk mengambil dan mengubah
konfigurasi aplikasi yang tersimpan di database.
"""

from app.models.base import db
from app.repositories.settings_repository import SettingsRepository


class SettingsService:
    """Service untuk business logic Pengaturan Sistem."""

    # =========================================================================
    # 1. AKSES KONFIGURASI (READ & GLOBAL)
    # =========================================================================
    # Fokus: Mengambil nilai pengaturan individu atau seluruhnya.

    @staticmethod
    def get(key, default=None):
        """Mengambil nilai setting berdasarkan key dengan fallback ke default."""
        setting = SettingsRepository.get(key)
        return setting if setting is not None else default

    @staticmethod
    def get_all():
        """Mengambil semua pengaturan dalam bentuk dictionary (Key: Value)."""
        data = SettingsRepository.get_all()
        defaults = {
            "warnet_title": "TMBilling",
            "warnet_announcement": "1. Jaga kebersihan dan ketertiban\n2. Dilarang membawa makanan dari luar\n3. Harap matikan PC setelah selesai bermain\n4. Hubungi kasir jika memerlukan bantuan",
            "qris_image_url": "/static/uploads/qris/default_qris.png"
        }
        for k, v in defaults.items():
            if k not in data or not data[k]:
                data[k] = v
        return data


    # =========================================================================
    # 2. KONFIGURASI SPESIFIK & UPDATE (SPECIFIC & WRITE)
    # =========================================================================
    # Fokus: Menangani logic pengaturan khusus (seperti Timer) dan update data.

    @staticmethod
    def get_auto_shutdown_timer():
        """
        Mengambil durasi auto-shutdown dalam detik.
        Jika belum diset, akan otomatis membuat nilai default 180 detik.
        """
        val = SettingsService.get("auto_shutdown_timer_seconds")
        
        if val is None:
            # Inisialisasi default jika key belum ada di database
            SettingsService.set("auto_shutdown_timer_seconds", "180")
            return 180
            
        try:
            return int(val)
        except (ValueError, TypeError):
            # Fallback jika data di database bukan angka valid
            return 180

    @staticmethod
    def set(key, value):
        """Menyimpan atau memperbarui nilai pengaturan."""
        SettingsRepository.set(key, value)
        db.session.commit()
