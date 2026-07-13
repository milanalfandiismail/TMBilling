# app/services/__init__.py

"""Modul services untuk business logic layer.

Modul ini mengandung semua service class yang menangani
business logic aplikasi billing warnet. Service layer ini
berfungsi sebagai intermediary antara controllers (routes)
dan repositories (data access).

Services:
    AuthService: Autentikasi client C# (member login).
    AuthKasirService: Autentikasi kasir/admin web dashboard.
    BackupService: Backup database SQLite periodik via background thread.
    BlackoutService: Penanganan mati lampu (deteksi & recovery).
    ClientService: Interface untuk client C# (status, identify).
    DashboardService: Data aggregation untuk dashboard kasir.
    GrupService: Manajemen grup/kategori PC.
    HardwareService: Telemetri hardware PC dari C# agent (suhu, load).
    MemberService: Manajemen member dan saldo waktu.
    PaketService: Manajemen paket harga.
    PCService: Manajemen unit komputer.
    ReportService: Laporan keuangan, struk, dan audit logs.
    SesiService: Manajemen sesi bermain (buka, tutup, pindah).
    SettingsService: Konfigurasi sistem key-value (auto-shutdown, dll).
    TransaksiService: Penomoran nota dan pencatatan transaksi.
    UserService: CRUD akun staff kasir/admin.
    PluginManager: Manajemen siklus hidup plugins eksternal.
"""

from app.services.settings.settings_service import SettingsService
from app.services.backup.backup_service import BackupService
from app.services.hardware.hardware_service import HardwareService
from app.services.menu.menu_service import MenuService
from app.services.transaksi.transaksi_service import TransaksiService
from app.services.user.user_service import UserService

from app.services.shift.shift_service import ShiftService
from app.services.auth.auth_kasir_service import AuthKasirService
from app.services.auth.auth_service import AuthService
from app.services.blackout.blackout_service import BlackoutService
from app.services.client.client_service import ClientService
from app.services.dashboard.dashboard_service import DashboardService
from app.services.grup.grup_service import GrupService
from app.services.member.member_service import MemberService
from app.services.paket.paket_service import PaketService
from app.services.pc.pc_service import PCService
from app.services.report.report_service import ReportService
from app.services.sesi.sesi_service import SesiService
from app.services.ip_whitelist.ip_whitelist_service import IpWhitelistService
from app.services.owner.analytics_service import OwnerAnalyticsService
from app.services.plugins.plugin_manager import PluginManager
from app.services.plugins.base_plugin import BasePlugin
from app.services.server_monitor.server_monitor_service import ServerMonitorService

__all__ = [
    "ShiftService",
    "AuthKasirService",
    "AuthService",
    "BlackoutService", 
    "BackupService",
    "ClientService",
    "DashboardService",
    "GrupService",
    "HardwareService",
    "MemberService",
    "MenuService",
    "OwnerAnalyticsService",
    "PaketService",
    "PCService",
    "PluginManager",
    "BasePlugin",
    "ReportService",
    "SesiService",
    "IpWhitelistService",
    "SettingsService",
    "TransaksiService",
    "UserService",
    "ServerMonitorService"
]