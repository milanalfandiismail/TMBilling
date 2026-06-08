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
"""

from app.services.auth_kasir_service import AuthKasirService
from app.services.auth_service import AuthService
from app.services.blackout_service import BlackoutService
from app.services.client_service import ClientService
from app.services.dashboard_service import DashboardService
from app.services.grup_service import GrupService
from app.services.member_service import MemberService
from app.services.paket_service import PaketService
from app.services.pc_service import PCService
from app.services.report_service import ReportService
from app.services.sesi_service import SesiService
from app.services.settings_service import SettingsService
from app.services.backup_service import BackupService

__all__ = [
    "AuthKasirService",
    "AuthService",
    "BlackoutService", 
    "BackupService",
    "ClientService",
    "DashboardService",
    "GrupService",
    "MemberService",
    "PaketService",
    "PCService",
    "ReportService",
    "SesiService",
    "SettingsService"
]