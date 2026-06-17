# app/models/__init__.py

"""Modul models untuk aplikasi billing warnet.

Modul ini mengumpulkan semua model SQLAlchemy yang digunakan
dalam aplikasi, menyediakan factory untuk database dan utility
serta exports untuk semua entitas utama.

Exports:
    db: SQLAlchemy database instance.
    now_local: Utility function untuk timestamp lokal.
    Grup: Model kategori/zona (reguler, vip, vvip).
    Paket: Model paket harga dan durasi.
    Member: Model pelanggan member.
    PC: Model unit komputer.
    Sesi: Model sesi bermain aktif.
    Transaksi: Model pencatatan keuangan.
    User: Model staff admin/kasir.
    Settings: Model konfigurasi sistem (key-value store).
    HardwareMonitor: Model metrik hardware PC dari C# agent.
"""

from app.models.base.base import db, now_local
from app.models.paket.paket import Paket
from app.models.member.member import Member
from app.models.grup.grup import Grup
from app.models.pc.pc import PC
from app.models.sesi.sesi import Sesi
from app.models.transaksi.transaksi import Transaksi
from app.models.user.user import User
from app.models.settings.settings import Settings
from app.models.hardware.hardware import HardwareMonitor, PCProcess
from app.models.menu.menu import MenuItem, TransaksiMenu
from app.models.tournament.tournament import Turnamen, TurnamenTahap, TurnamenTim, TurnamenMatch
from app.models.shift.shift_record import ShiftRecord

__all__ = [
    'db', 'now_local', 'Grup', 'Paket', 'Member', 'PC', 'Sesi', 'Transaksi', 
    'User', 'Settings', 'HardwareMonitor', 'PCProcess', 'MenuItem', 'TransaksiMenu',
    'Turnamen', 'TurnamenTahap', 'TurnamenTim', 'TurnamenMatch',
    'ShiftRecord'
]