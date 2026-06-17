# app/repositories/__init__.py

"""Modul repositories untuk akses data (Data Access Layer).

Modul ini menyediakan interface terpusat untuk semua operasi database
menggunakan Repository Pattern. Setiap repository menangani entitas
spesifik dan menyediakan methods untuk CRUD serta query khusus.

Example:
    >>> from app.repositories import MemberRepository, SesiRepository
    >>> member = MemberRepository.get_by_username("john_doe")
    >>> sesi_aktif = SesiRepository.get_all_aktif()
"""

from app.repositories.member.member_repository import MemberRepository
from app.repositories.grup.grup_repository import GrupRepository
from app.repositories.paket.paket_repository import PaketRepository
from app.repositories.pc.pc_repository import PCRepository
from app.repositories.sesi.sesi_repository import SesiRepository
from app.repositories.transaksi.transaksi_repository import TransaksiRepository
from app.repositories.user.user_repository import UserRepository
from app.repositories.settings.settings_repository import SettingsRepository
from app.repositories.menu.menu_repository import MenuRepository
from app.repositories.hardware.hardware_repository import HardwareRepository
from app.repositories.process.process_repository import ProcessRepository

__all__ = [
    "MemberRepository",
    "PaketRepository",
    "PCRepository",
    "GrupRepository",
    "SesiRepository",
    "TransaksiRepository",
    "UserRepository",
    'SettingsRepository',
    "MenuRepository",
    "HardwareRepository",
    "ProcessRepository"
]