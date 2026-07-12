"""Package utama aplikasi TMBilling.

Module ini berisi factory function create_app() yang menginisialisasi
dan mengkonfigurasi instance Flask, termasuk:
- Memuat konfigurasi dari Config class.
- Mengaktifkan CORS untuk cross-origin requests.
- Menginisialisasi database SQLAlchemy.
- Mendaftarkan semua Blueprint (API routes).
- Membuat tabel database secara otomatis jika belum ada.

Exports:
    create_app: Factory function untuk membuat instance Flask app.
"""

from flask import Flask, current_app, redirect, render_template, request
from flask_cors import CORS
import os

from flask_migrate import Migrate
from flask_wtf import CSRFProtect
from app.models import db
from app.config import Config

csrf = CSRFProtect()
migrate = Migrate()


def create_app():
    """Membuat dan mengkonfigurasi instance aplikasi Flask.
    
    Factory pattern digunakan agar aplikasi bisa diinstansiasi
    beberapa kali dengan konfigurasi berbeda (contoh: testing).
    
    Returns:
        Flask: Instance aplikasi Flask yang sudah terkonfigurasi lengkap
               dengan semua blueprint, database, dan CORS.
    """
    app = Flask(__name__, template_folder='templates')
    app.config.from_object(Config)

    # Konfigurasi CORS yang lebih ketat
    allowed_origins = os.environ.get('ALLOWED_ORIGINS', '*').split(',')
    CORS(app, resources={r"/*": {"origins": allowed_origins}}, supports_credentials=True)

    db.init_app(app)
    csrf.init_app(app)
    migrate.init_app(app, db)

    # IP Whitelist middleware — proteksi dashboard /kasir dan /api/v1/kasir/*
    from app.middleware import check_ip_whitelist
    app.before_request(check_ip_whitelist)

    os.makedirs("logs", exist_ok=True)

    # Import dan registrasi blueprints
    from app.routes import (
        auth_api_bp,
        auth_kasir_api_bp,
        migration_api_bp,
        blackout_api_bp,
        client_api_bp,
        dashboard_bp,
        dashboard_api_bp,
        member_api_bp,
        paket_api_bp,
        pc_api_bp,
        report_api_bp,
        sesi_api_bp,
        grup_api_bp,
        settings_api_bp,
        monitor_api_bp,
        monitor_kasir_bp,
        user_api_bp,
        menu_api_bp,
        backup_api_bp,
        tournament_api_bp,
        member_portal_bp,
        shift_api_bp,
        migration_api_bp,
        mikrotik_api_bp,
        game_kasir_api_bp,
        game_public_api_bp
    )

    # ==========================================
    # 1. FRONTEND / WEB VIEWS
    # ==========================================
    app.register_blueprint(dashboard_bp, url_prefix="/kasir")
    app.register_blueprint(member_portal_bp)
    
    # ==========================================
    # 2. KASIR APIs (/api/v1/kasir/...)
    # ==========================================
    app.register_blueprint(auth_kasir_api_bp, url_prefix="/api/v1/kasir/auth")
    app.register_blueprint(dashboard_api_bp, url_prefix="/api/v1/kasir/dashboard")
    app.register_blueprint(member_api_bp, url_prefix="/api/v1/kasir/member")
    app.register_blueprint(paket_api_bp, url_prefix="/api/v1/kasir/paket")
    app.register_blueprint(pc_api_bp, url_prefix="/api/v1/kasir/pc")
    app.register_blueprint(sesi_api_bp, url_prefix="/api/v1/kasir/sesi")
    app.register_blueprint(grup_api_bp, url_prefix="/api/v1/kasir/grup")
    app.register_blueprint(user_api_bp, url_prefix="/api/v1/kasir/user")
    app.register_blueprint(menu_api_bp, url_prefix="/api/v1/kasir/menu")
    app.register_blueprint(report_api_bp, url_prefix="/api/v1/kasir/report")
    app.register_blueprint(shift_api_bp, url_prefix="/api/v1/kasir/shift")
    app.register_blueprint(backup_api_bp, url_prefix="/api/v1/kasir/backup")
    app.register_blueprint(blackout_api_bp, url_prefix="/api/v1/kasir/blackout")
    app.register_blueprint(tournament_api_bp, url_prefix="/api/v1/kasir/tournament")
    app.register_blueprint(settings_api_bp, url_prefix="/api/v1/kasir/settings")
    app.register_blueprint(migration_api_bp, url_prefix="/api/v1/kasir/settings/migration")
    app.register_blueprint(mikrotik_api_bp, url_prefix="/api/v1/kasir/mikrotik")
    from app.routes.settings.plugin_routes import plugin_api_bp
    app.register_blueprint(plugin_api_bp, url_prefix="/api/v1/kasir/settings/plugins")
    app.register_blueprint(monitor_kasir_bp, url_prefix="/api/v1/kasir/monitor")
    app.register_blueprint(game_kasir_api_bp, url_prefix="/api/v1/kasir/game")

    # ==========================================
    # 3. PUBLIC APIs (/api/v1/public/...)
    # ==========================================
    app.register_blueprint(auth_api_bp, url_prefix="/api/v1/public/auth")
    app.register_blueprint(client_api_bp, url_prefix="/api/v1/public/client")
    app.register_blueprint(monitor_api_bp, url_prefix="/api/v1/public/monitor")
    app.register_blueprint(game_public_api_bp, url_prefix="/api/v1/public/game")
    
    # ==========================================
    # 4. CSRF EXEMPTIONS (APIs using Tokens/Keys)
    # ==========================================
    csrf.exempt(client_api_bp)
    csrf.exempt(auth_api_bp)
    csrf.exempt(monitor_api_bp)
    csrf.exempt(shift_api_bp)

    @app.route("/")
    def index():
        """Render public warnet homepage (landing page)."""
        from app.services import SettingsService
        # Ambil aturan warnet dari database dengan fallback jika tidak diset
        default_rules = (
            "1. Jaga ketertiban, ketenangan, dan kebersihan di area warnet.\n"
            "2. Dilarang membuka situs ilegal, pornografi, atau SARA.\n"
            "3. Dilarang membawa makanan dan minuman dari luar area warnet.\n"
            "4. Laporkan setiap kendala hardware/software langsung ke petugas kasir.\n"
            "5. Harap log out akun member sebelum meninggalkan komputer Anda."
        )
        warnet_rules = SettingsService.get("warnet_announcement", default_rules)
        return render_template("public/landing/index.html", warnet_rules=warnet_rules)

    @app.route("/livepc")
    def public_pc_map():
        """Render halaman khusus peta PC live."""
        from app.models import Grup
        groups = Grup.query.all()
        return render_template("public/livepc/index.html", groups=groups)

    @app.route("/paket")
    def public_packages():
        """Render halaman daftar paket warnet per grup."""
        from app.models import Grup
        from app.models import Paket

        all_groups = Grup.query.all()
        active_packages = Paket.query.filter_by(aktif=True).order_by(Paket.harga).all()

        groups_with_packages = []
        for g in all_groups:
            g_active_pkgs = [p for p in active_packages if p.grup_id == g.id]
            if g_active_pkgs:
                g.active_paket_list = g_active_pkgs
                groups_with_packages.append(g)

        return render_template("public/paket/index.html", groups=groups_with_packages)

    @app.route("/spesifikasi")
    def public_specs():
        """Render halaman grid spesifikasi hardware PC dinamis terkelompok per grup."""
        import re
        from app.models import Grup
        groups = Grup.query.all()
        
        def extract_number(pc):
            match = re.search(r'\d+', pc.kode)
            return int(match.group()) if match else 0
            
        # Ambil grup yang memiliki PC terdaftar dan urutkan secara natural (TM-1, TM-2, ..., TM-10)
        groups_with_pcs = []
        for g in groups:
            if len(g.pc_list) > 0:
                g.sorted_pc_list = sorted(g.pc_list, key=extract_number)
                groups_with_pcs.append(g)
                
        return render_template("public/specs/index.html", groups=groups_with_pcs)

    @app.route("/gamelist")
    def public_gamelist():
        """Render halaman grid game publik."""
        return render_template("public/gamelist/index.html")

    @app.context_processor
    def inject_global_settings():
        try:
            from app.services import SettingsService
            title = SettingsService.get("warnet_title", "TMBilling")
        except Exception:
            title = "TMBilling"
            
        try:
            from app.services.plugins.plugin_manager import PluginManager
            plugin_menus = PluginManager.get_instance().get_active_menus()
        except Exception:
            plugin_menus = []
            
        from app.utils.timezone_utils import format_display
        version = current_app.config.get("VERSION", "v1.0")
        return dict(warnet_title=title, plugin_menus=plugin_menus, version=version, format_display=format_display)

    with app.app_context():
        db.create_all()
        
        # Load Plugins and their models/blueprints
        try:
            from app.services.plugins.plugin_manager import PluginManager
            pm = PluginManager.get_instance()
            pm.init_app(app)
            # Second pass to create tables for plugin models
            db.create_all()
            # Register plugin blueprints
            pm.register_blueprints()
        except Exception as e:
            app.logger.error(f"Gagal memuat PluginManager: {e}")
        
        # Seed IP whitelist defaults (idempotent)
        try:
            from app.services import IpWhitelistService
            IpWhitelistService.seed_defaults(app)
        except Exception as e:
            app.logger.warning(f"Gagal seed IP whitelist defaults: {e}")
        
        # Otomatis buat user admin default jika database kosong
        try:
            from app.models import User
            if User.query.count() == 0:
                admin = User(
                    username="admin",
                    nama_lengkap="Administrator",
                    role="admin",
                    aktif=True
                )
                admin.set_password("admin123")
                db.session.add(admin)
                db.session.commit()
                print("✅ [TMBilling] Database kosong. Admin default otomatis dibuat (username: admin, password: admin123)")
        except Exception as e:
            app.logger.error(f"Gagal membuat admin default saat bootstrap: {e}")

    return app
