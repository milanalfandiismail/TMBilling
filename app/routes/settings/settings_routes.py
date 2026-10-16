"""Routes untuk manajemen pengaturan sistem TMBilling.

Blueprint ini menyatukan sub-modul rute pengaturan:
- general_routes: Konfigurasi global, timezone, polling, scheduler.
- network_routes: IP Whitelist, Cloudflare Tunnel, App Public URL.
- database_routes: Backup manual/download, purge & vacuum, QRIS, uninstall token.
"""
from flask import Blueprint

settings_api_bp = Blueprint("settings", __name__)

# Register all modular route handlers onto settings_api_bp
from app.routes.settings import general_routes
from app.routes.settings import network_routes
from app.routes.settings import database_routes

__all__ = ["settings_api_bp"]
