# app/services/settings_service.py

"""Service untuk manajemen pengaturan sistem.

Modul ini menyediakan interface untuk mengambil dan mengubah
konfigurasi aplikasi yang tersimpan di database.
"""

import secrets

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
        """Mengambil nilai setting berdasarkan key dari RAM cache (fallback DB, cache miss negatif)."""
        from app.services.cache.system_cache_store import SettingsCacheStore
        val = SettingsCacheStore.get(key)
        if val is not None:
            return val
        if SettingsCacheStore.is_missing(key):
            return default
        if not SettingsCacheStore.is_complete():
            # Snapshot cache belum tentu lengkap: konfirmasi ke DB sekali saja.
            setting = SettingsRepository.get(key)
            if setting is not None:
                SettingsCacheStore.set(key, str(setting))
                return setting
        SettingsCacheStore.mark_missing(key)
        return default

    @staticmethod
    def get_all():
        """Mengambil semua pengaturan dalam bentuk dictionary (Key: Value) dari RAM cache."""
        from app.services.cache.system_cache_store import SettingsCacheStore
        data = SettingsCacheStore.get_all()
        if not data:
            data = SettingsRepository.get_all()
            SettingsCacheStore.update_dict(data)
        defaults = {
            "warnet_title": "TMBilling",
            "warnet_announcement": "",
            "warnet_address": "Jl. Merdeka No. 123, Kota",
            "warnet_phone": "0812-3456-7890",
            "warnet_footer": "Terima kasih, selamat bermain!",
            "warnet_gmaps": "",
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
            "payment_methods": "Tunai,QRIS,Transfer Bank",
            "client_polling_interval_seconds": "5"
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
    def get_client_polling_interval():
        """
        Mengambil interval polling PC client dalam detik (1, 5, atau 10 detik).
        Jika belum diset atau di luar preset, fallback ke 5 detik.
        """
        val = SettingsService.get("client_polling_interval_seconds")
        if val is None:
            SettingsService.set("client_polling_interval_seconds", "5")
            return 5
        try:
            interval = int(val)
            if interval in (1, 5, 10):
                return interval
            return 5
        except (ValueError, TypeError):
            return 5

    @staticmethod
    def set_client_polling_interval(interval_seconds):
        """
        Menyimpan interval polling PC client dengan validasi ketat (hanya 1, 5, atau 10).
        """
        try:
            val = int(interval_seconds)
        except (ValueError, TypeError):
            raise ValueError("Interval polling client harus berupa angka (1, 5, atau 10 detik)")
        
        if val not in (1, 5, 10):
            raise ValueError("Interval polling client hanya boleh 1, 5, atau 10 detik")

        SettingsService.set("client_polling_interval_seconds", str(val))
        return val

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
        """Menyimpan atau memperbarui nilai pengaturan (Write-Through DB & RAM)."""
        SettingsRepository.set(key, value)
        db.session.commit()
        from app.services.cache.system_cache_store import SettingsCacheStore
        SettingsCacheStore.set(key, str(value))

    @staticmethod
    def get_or_create_vnc_password():
        """Mengambil vnc_password atau membuatnya secara otomatis jika belum ada / masih default publik."""
        current_pwd = (SettingsService.get("vnc_password") or "").strip()
        if not current_pwd or current_pwd == "tmbilling123":
            current_pwd = secrets.token_urlsafe(8)
            SettingsService.set("vnc_password", current_pwd)
        return current_pwd

    @staticmethod
    def get_or_create_emergency_token():
        """Token emergency login; dibuat acak sekali lalu disimpan permanen."""
        token = SettingsService.get("emergency_token")
        if not token:
            token = secrets.token_urlsafe(32)
            SettingsService.set("emergency_token", token)
        return token

    @staticmethod
    def get_or_create_uninstall_token():
        """Token uninstall klien; dibuat acak sekali lalu disimpan permanen."""
        token = SettingsService.get("uninstall_token")
        if not token:
            token = secrets.token_urlsafe(32)
            SettingsService.set("uninstall_token", token)
        return token

