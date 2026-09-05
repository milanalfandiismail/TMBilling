# app/services/settings_service.py

"""Service untuk manajemen pengaturan sistem.

Modul ini menyediakan interface untuk mengambil dan mengubah
konfigurasi aplikasi yang tersimpan di database.
"""

from app.models import db
from app.repositories import SettingsRepository


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
            "warnet_announcement": "",
            "warnet_address": "Jl. Merdeka No. 123, Kota",
            "warnet_phone": "0812-3456-7890",
            "warnet_footer": "Terima kasih, selamat bermain!",
            "qris_image_url": "/static/uploads/qris/default_qris.png",
            "mikrotik_enabled": "0",
            "mikrotik_host": "192.168.1.1",
            "mikrotik_port": "8728",
            "mikrotik_username": "admin",
            "mikrotik_password": "",
            "mikrotik_hotspot_profile": "default",
            "screenshot_auto_enabled": "0",
            "screenshot_auto_value": "60",
            "screenshot_auto_unit": "detik",
            "payment_methods": "Tunai,QRIS,Transfer Bank"
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

    @staticmethod
    def get_or_create_branch_api_key():
        """Mengambil branch_api_key atau membuatnya secara otomatis jika belum ada."""
        import secrets
        key = SettingsService.get("branch_api_key")
        if not key:
            key = "tmb_sec_" + secrets.token_hex(24)
            SettingsService.set("branch_api_key", key)
        return key

    @staticmethod
    def regenerate_branch_api_key():
        """Membuat ulang branch_api_key lokal dengan token acak baru."""
        import secrets
        key = "tmb_sec_" + secrets.token_hex(24)
        SettingsService.set("branch_api_key", key)
        return key
