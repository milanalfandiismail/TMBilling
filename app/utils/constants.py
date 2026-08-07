# app/utils/constants.py

"""Definisi Enum dan Konstanta Terpusat untuk TMBilling.

Modul ini mengeliminasi string hardcoded (magic strings) di seluruh codebase,
sehingga status PC, tipe sesi, status sesi, dan jenis transaksi terstandarisasi.
"""

from enum import Enum


class PCStatus(str, Enum):
    """Status operasional unit PC."""
    KOSONG = "kosong"
    TERPAKAI = "terpakai"
    OFFLINE = "offline"
    MAINTENANCE = "maintenance"
    ADMIN = "admin"


class SesiType(str, Enum):
    """Jenis sesi bermain."""
    GUEST = "guest"
    MEMBER = "member"
    ADMIN = "admin"


class SesiStatus(str, Enum):
    """Status siklus hidup sesi."""
    AKTIFF = "aktif"
    SELESAI = "selesai"
    TERKUNCI = "terkunci"


class TransaksiJenis(str, Enum):
    """Kategori jenis transaksi billing & kantin."""
    BELI_PAKET_GUEST = "beli_paket_guest"
    TAMBAH_WAKTU_GUEST = "tambah_waktu_guest"
    BELI_PAKET_MEMBER = "beli_paket_member"
    TAMBAH_WAKTU_SESI = "tambah_waktu_sesi"
    REFUND_GUEST = "refund_guest"
    REFUND_MEMBER = "refund_member"
    TRANSAKSI_MENU = "transaksi_menu"


class PaymentMethod(str, Enum):
    """Metode pembayaran yang didukung."""
    TUNAI = "Tunai"
    QRIS = "QRIS"
    TRANSFER = "Transfer"
    DEPOSIT = "Deposit"
