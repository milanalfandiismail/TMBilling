# app/routes/__init__.py

"""Modul routes untuk API endpoints.

Modul ini mengumpulkan dan mengekspor semua Flask Blueprints
yang mendefinisikan endpoint API aplikasi billing warnet.

Blueprints:
    auth_bp: Autentikasi client C# (member).
    auth_kasir_bp: Autentikasi kasir/admin web.
    blackout_bp: Manajemen insiden mati lampu/blackout.
    client_bp: Endpoint komunikasi client C#.
    dashboard_bp: Dashboard kasir (HTML & API).
    grup_bp: Manajemen grup/kategori.
    member_bp: Manajemen member/pelanggan.
    monitor_bp: Hardware monitoring (suhu, load, spesifikasi PC).
    paket_bp: Manajemen paket harga.
    pc_bp: Manajemen unit komputer.
    report_bp: Laporan keuangan, struk, dan audit logs.
    sesi_bp: Operasi sesi bermain (buka, tutup, pindah).
    settings_bp: Konfigurasi sistem (auto-shutdown, backup).
    user_bp: CRUD akun staff kasir/admin.
"""

from app.routes.auth_routes import auth_bp
from app.routes.auth_kasir_routes import auth_kasir_bp
from app.routes.client_routes import client_bp
from app.routes.dashboard_routes import dashboard_bp
from app.routes.member_routes import member_bp
from app.routes.paket_routes import paket_bp
from app.routes.pc_routes import pc_bp
from app.routes.report_routes import report_bp
from app.routes.sesi_routes import sesi_bp
from app.routes.grup_routes import grup_bp
from app.routes.blackout_routes import blackout_bp
from app.routes.settings_routes import settings_bp
from app.routes.monitor_routes import monitor_bp
from app.routes.user_routes import user_bp
from app.routes.menu_routes import menu_bp

__all__ = [
    'auth_bp', 'auth_kasir_bp', 'client_bp', 'dashboard_bp',
    'member_bp', 'paket_bp', 'pc_bp', 'report_bp', 'sesi_bp',
    'grup_bp', 'blackout_bp', 'settings_bp', 'monitor_bp', 'user_bp',
    'menu_bp'
]