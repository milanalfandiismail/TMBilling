# app/routes/__init__.py

"""Modul routes untuk API endpoints.

Modul ini mengumpulkan dan mengekspor semua Flask Blueprints
yang mendefinisikan endpoint API aplikasi billing warnet.

Blueprints:
    auth_api_bp: Autentikasi client C# (member).
    auth_kasir_api_bp: Autentikasi kasir/admin web.
    blackout_api_bp: Manajemen insiden mati lampu/blackout.
    client_api_bp: Endpoint komunikasi client C#.
    dashboard_bp: Dashboard kasir (HTML & API).
    grup_api_bp: Manajemen grup/kategori.
    member_api_bp: Manajemen member/pelanggan.
    monitor_api_bp: Hardware monitoring (suhu, load, spesifikasi PC).
    paket_api_bp: Manajemen paket harga.
    pc_api_bp: Manajemen unit komputer.
    report_api_bp: Laporan keuangan, struk, dan audit logs.
    sesi_api_bp: Operasi sesi bermain (buka, tutup, pindah).
    settings_api_bp: Konfigurasi sistem (auto-shutdown, backup).
    user_api_bp: CRUD akun staff kasir/admin.
"""

from app.routes.auth.auth_routes import auth_api_bp
from app.routes.auth.auth_kasir_routes import auth_kasir_api_bp
from app.routes.client.client_routes import client_api_bp
from app.routes.dashboard.dashboard_routes import dashboard_bp, dashboard_api_bp
from app.routes.member.member_routes import member_api_bp
from app.routes.paket.paket_routes import paket_api_bp
from app.routes.pc.pc_routes import pc_api_bp
from app.routes.report.report_routes import report_api_bp
from app.routes.sesi.sesi_routes import sesi_api_bp
from app.routes.grup.grup_routes import grup_api_bp
from app.routes.blackout.blackout_routes import blackout_api_bp
from app.routes.settings.settings_routes import settings_api_bp
from app.routes.monitor.monitor_routes import monitor_api_bp, monitor_kasir_bp
from app.routes.user.user_routes import user_api_bp
from app.routes.menu.menu_routes import menu_api_bp
from app.routes.backup.backup_routes import backup_api_bp
from app.routes.tournament.tournament_routes import tournament_api_bp
from app.routes.member.member_portal_routes import member_portal_bp
from app.routes.shift.shift_routes import shift_api_bp
from app.routes.settings.migration_routes import migration_api_bp
from app.routes.settings.plugin_routes import plugin_api_bp
from app.routes.mikrotik.mikrotik_routes import mikrotik_api_bp
from app.routes.game.game_kasir_routes import game_kasir_api_bp
from app.routes.game.game_public_routes import game_public_api_bp
from app.routes.server_monitor.monitor_routes import server_monitor_bp
from app.routes.vnc.vnc_routes import vnc_api_bp
from app.routes.maintenance.maintenance_routes import maintenance_api_bp

__all__ = [
    'auth_api_bp', 'auth_kasir_api_bp', 'client_api_bp', 'dashboard_bp',
    'dashboard_api_bp', 'member_api_bp', 'paket_api_bp', 'pc_api_bp', 'report_api_bp', 
    'sesi_api_bp', 'grup_api_bp', 'blackout_api_bp', 'settings_api_bp', 'monitor_api_bp', 'monitor_kasir_bp', 
    'user_api_bp', 'menu_api_bp', 'backup_api_bp', 'tournament_api_bp', 
    'member_portal_bp', 'shift_api_bp', 'migration_api_bp', 'plugin_api_bp', 'mikrotik_api_bp',
    'game_kasir_api_bp', 'game_public_api_bp', 'server_monitor_bp', 'vnc_api_bp', 'maintenance_api_bp'
]