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

from app.repositories.member_repository import MemberRepository
from app.repositories.grup_repository import GrupRepository
from app.repositories.paket_repository import PaketRepository
from app.repositories.pc_repository import PCRepository
from app.repositories.sesi_repository import SesiRepository
from app.repositories.transaksi_repository import TransaksiRepository
from app.repositories.user_repository import UserRepository
from app.repositories.settings_repository import SettingsRepository

__all__ = [
    "MemberRepository",
    "PaketRepository",
    "PCRepository",
    "GrupRepository",
    "SesiRepository",
    "TransaksiRepository",
    "UserRepository",
    'SettingsRepository'
]