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

from flask import Flask, current_app, redirect, render_template, request, g
from flask_cors import CORS
import os
import hmac
import secrets
import string

from flask_migrate import Migrate
from flask_wtf import CSRFProtect
from app.models import db
from app.config import Config

class TMBillingCSRFProtect(CSRFProtect):
    """Custom CSRFProtect yang memvalidasi header Bearer token (API Key).
    
    Hanya request dengan Bearer token yang valid dan cocok dengan API Key terdaftar
    yang dibebaskan dari verifikasi CSRF cookie. Token palsu/acak akan tetap
    menjalani verifikasi CSRF standar.
    """
    def protect(self, apply_exemptions=False):
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
            if token:
                try:
                    from app.services.settings.settings_service import SettingsService
                    client_api_key = SettingsService.get("client_api_key") or os.environ.get("CLIENT_API_KEY", "")
                    if client_api_key and hmac.compare_digest(token, client_api_key):
                        return
                except Exception:
                    pass
        super().protect(apply_exemptions=apply_exemptions)


csrf = TMBillingCSRFProtect()
migrate = Migrate()


def _register_blueprints(app):
    """Mendaftarkan seluruh blueprint pada aplikasi."""
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
        mikrotik_api_bp,
        game_kasir_api_bp,
        game_public_api_bp,
        server_monitor_bp,
        plugin_api_bp,
        vnc_api_bp,
        maintenance_api_bp,
        uptime_api_bp,
        tv_public_api_bp,
        health_api_bp,
        tutorial_api_bp,
        notes_api_bp
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
    app.register_blueprint(server_monitor_bp)
    app.register_blueprint(blackout_api_bp, url_prefix="/api/v1/kasir/blackout")
    app.register_blueprint(tournament_api_bp, url_prefix="/api/v1/kasir/tournament")
    app.register_blueprint(settings_api_bp, url_prefix="/api/v1/kasir/settings")
    app.register_blueprint(migration_api_bp, url_prefix="/api/v1/kasir/settings/migration")
    app.register_blueprint(mikrotik_api_bp, url_prefix="/api/v1/kasir/mikrotik")
    app.register_blueprint(shift_api_bp, url_prefix="/api/v1/kasir/shift")
    app.register_blueprint(backup_api_bp, url_prefix="/api/v1/kasir/backup")
    app.register_blueprint(plugin_api_bp, url_prefix="/api/v1/kasir/settings/plugins")
    app.register_blueprint(monitor_kasir_bp, url_prefix="/api/v1/kasir/monitor")
    app.register_blueprint(game_kasir_api_bp, url_prefix="/api/v1/kasir/game")
    app.register_blueprint(vnc_api_bp, url_prefix="/api/v1/kasir/vnc")
    app.register_blueprint(maintenance_api_bp, url_prefix="/api/v1/kasir/maintenance")
    app.register_blueprint(uptime_api_bp, url_prefix="/api/v1/kasir/uptime")
    app.register_blueprint(tutorial_api_bp, url_prefix="/api/v1/kasir/tutorials")
    app.register_blueprint(notes_api_bp, url_prefix="/api/v1/kasir/notes")

    # ==========================================
    # 3. PUBLIC APIs (/api/v1/public/...)
    # ==========================================
    app.register_blueprint(auth_api_bp, url_prefix="/api/v1/public/auth")
    app.register_blueprint(client_api_bp, url_prefix="/api/v1/public/client")
    app.register_blueprint(monitor_api_bp, url_prefix="/api/v1/public/monitor")
    app.register_blueprint(game_public_api_bp, url_prefix="/api/v1/public/game")
    app.register_blueprint(tv_public_api_bp, url_prefix="/api/v1/public/tv")
    app.register_blueprint(health_api_bp, url_prefix="/api")
    
    # ==========================================
    # 4. CSRF EXEMPTIONS (APIs using Tokens/Keys)
    # ==========================================
    csrf.exempt(client_api_bp)
    csrf.exempt(auth_api_bp)
    csrf.exempt(monitor_api_bp)
    csrf.exempt(server_monitor_bp)

def _register_public_routes(app):
    """Mendaftarkan route publik."""
    @app.route("/")
    def index():
        """Render public warnet homepage (landing page)."""
        from app.services import SettingsService
        from app.utils.helpers import parse_google_maps_info
        warnet_rules = SettingsService.get("warnet_announcement", "")
        warnet_address = SettingsService.get("warnet_address", "Jl. Merdeka No. 123, Kota")
        warnet_phone = SettingsService.get("warnet_phone", "0812-3456-7890")
        warnet_gmaps_raw = SettingsService.get("warnet_gmaps", "")
        gmaps_info = parse_google_maps_info(warnet_gmaps_raw, warnet_address=warnet_address)
        return render_template(
            "public/landing/index.html",
            warnet_rules=warnet_rules,
            warnet_address=warnet_address,
            warnet_phone=warnet_phone,
            gmaps_info=gmaps_info
        )

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
        import json
        import re
        from app.models import Grup, PC
        from sqlalchemy.orm import joinedload, selectinload
        groups = (
            Grup.query
            .options(
                selectinload(Grup.pc_list).joinedload(PC.hardware),
                selectinload(Grup.paket_list),
            )
            .all()
        )
        
        def extract_number(pc):
            match = re.search(r"\d+", pc.kode)
            return int(match.group()) if match else 0
            
        # Ambil grup yang memiliki PC terdaftar dan urutkan secara natural (TM-1, TM-2, ..., TM-10)
        groups_with_pcs = []
        specs_catalog = {}

        for g in groups:
            if len(g.pc_list) > 0:
                g.sorted_pc_list = sorted(g.pc_list, key=extract_number)
                groups_with_pcs.append(g)

                # Estimasi tarif per jam dari paket termurah jika tersedia
                hourly_rate = None
                if getattr(g, "paket_list", None):
                    for p in g.paket_list:
                        if p.aktif and p.durasi_menit > 0:
                            rate = (p.harga / p.durasi_menit) * 60
                            if hourly_rate is None or rate < hourly_rate:
                                hourly_rate = int(round(rate))

                for pc in g.sorted_pc_list:
                    hw = pc.hardware
                    baseline = {}
                    if hw and hw.hardware_baseline:
                        try:
                            baseline = json.loads(hw.hardware_baseline) if isinstance(hw.hardware_baseline, str) else hw.hardware_baseline
                        except Exception:
                            baseline = {}

                    specs_catalog[pc.kode] = {
                        "kode": pc.kode,
                        "grup": {
                            "nama": g.nama,
                            "warna": g.warna or "#3b82f6",
                            "hourly_rate": hourly_rate,
                        },
                        "online": bool(pc.aktif),
                        "cpu": {
                            "name": hw.cpu_name if (hw and hw.cpu_name) else "Belum Terkumpul",
                            "cores": baseline.get("cpu", {}).get("cores", None) if isinstance(baseline.get("cpu"), dict) else None,
                        },
                        "gpu": {
                            "name": hw.gpu_name if (hw and hw.gpu_name) else "Belum Terkumpul",
                        },
                        "ram": {
                            "total": hw.total_ram if (hw and hw.total_ram) else "Belum Terkumpul",
                            "sticks": baseline.get("ram_sticks", []) if isinstance(baseline.get("ram_sticks"), list) else [],
                        },
                    }

        return render_template(
            "public/specs/index.html",
            groups=groups_with_pcs,
            specs_catalog_json=json.dumps(specs_catalog),
        )

    @app.route("/games")
    def public_games():
        """Render halaman daftar game (Game Launcher)."""
        return render_template("public/game/index.html")

    @app.route("/tv")
    @app.route("/tv/static")
    @app.route("/tv-static")
    def public_tv_static():
        """Render public Smart TV Static Widescreen Dashboard view."""
        return render_template("public/tv/static.html")

    @app.route("/tv/dynamic")
    def public_tv_dynamic():
        """Redirect legacy dynamic TV route to unified widescreen TV dashboard."""
        return redirect("/tv")

def _register_context_processors(app):
    """Mendaftarkan context processor untuk template jinja."""
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
        from app.config import Config
        raw_version = current_app.config.get("VERSION", Config.VERSION)
        version_tag = f"v{raw_version}" if not str(raw_version).startswith("v") else str(raw_version)
        v_cache = "".join(c for c in str(raw_version) if c.isdigit()) or Config.get_cache_version()
        return dict(
            warnet_title=title,
            plugin_menus=plugin_menus,
            version=version_tag,
            app_version=raw_version,
            v_cache=v_cache,
            format_display=format_display
        )

def _init_app_context(app):
    """Inisialisasi yang membutuhkan app context (database, plugin, admin)."""
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
        
        # Init Cloudflare Tunnel auto-start daemon jika enabled
        try:
            from app.services import CloudflareTunnelService
            CloudflareTunnelService.init_app(app)
        except Exception as e:
            app.logger.warning(f"Gagal inisialisasi CloudflareTunnelService: {e}")

        # Seed tutorial/panduan awal sistem jika database kosong
        try:
            from app.services import TutorialService
            TutorialService.seed_initial_tutorials()
        except Exception as e:
            app.logger.warning(f"Gagal seed tutorial awal: {e}")
        
        # Otomatis buat user admin awal jika database kosong
        try:
            from app.models import User
            if User.query.count() == 0:
                chars = string.ascii_letters + string.digits
                tmp_pwd = "".join(secrets.choice(chars) for _ in range(12))

                admin = User(
                    username="admin",
                    nama_lengkap="Administrator",
                    role="admin",
                    aktif=True
                )
                admin.set_password(tmp_pwd)
                db.session.add(admin)
                db.session.commit()

                is_testing = app.config.get("TESTING") or os.environ.get("FLASK_ENV") == "testing"
                project_root = app.config.get("PROJECT_ROOT")
                if project_root or not is_testing:
                    try:
                        target_root = project_root or os.path.abspath(os.path.join(app.root_path, ".."))
                        info_path = os.path.join(target_root, "initial_admin.txt")
                        with open(info_path, "w", encoding="utf-8") as f:
                            f.write("=== TMBILLING INITIAL SUPERADMIN CREDENTIALS ===\n")
                            f.write("Username: admin\n")
                            f.write(f"Password: {tmp_pwd}\n")
                            f.write("CATATAN: Harap segera login dan ubah password ini di Dashboard Kasir.\n")
                            f.write("Berkas ini dapat Anda hapus setelah berhasil login.\n")
                        print(f"[PENTING] [TMBilling] Admin awal dibuat. Username: admin | Password sementara: {tmp_pwd}")
                        print(f"[PENTING] Kredensial telah disimpan di: {info_path}")
                    except Exception as io_err:
                        app.logger.warning(f"Gagal mencatat initial_admin.txt: {io_err}")
        except Exception as e:
            app.logger.error(f"Gagal membuat admin default saat bootstrap: {e}")

        # Self-healing bootstrap & schema auto-migration (Non-destructive)
        try:
            from sqlalchemy import inspect, text
            inspector = inspect(db.engine)
            # Auto-migration v1.6.5-rc2: Subsystem multi-branch dihapus (tabel cabang & cabang_inbound di-drop via migration)

            # Auto-migration v1.6.2: User kuota benefit columns
            if inspector.has_table('user'):
                user_cols = [c['name'] for c in inspector.get_columns('user')]
                with db.engine.connect() as conn:
                    if 'kuota_main_bulanan' not in user_cols:
                        conn.execute(text("ALTER TABLE user ADD COLUMN kuota_main_bulanan INTEGER DEFAULT 0"))
                    if 'sisa_kuota_menit' not in user_cols:
                        conn.execute(text("ALTER TABLE user ADD COLUMN sisa_kuota_menit INTEGER DEFAULT 0"))
                    if 'terakhir_reset_kuota' not in user_cols:
                        conn.execute(text("ALTER TABLE user ADD COLUMN terakhir_reset_kuota VARCHAR(7)"))
                    conn.commit()

            # Auto-migration v1.6.2: Sesi user_id, kolom AFK, dan sesi_asal_id
            if inspector.has_table('sesi'):
                sesi_cols = [c['name'] for c in inspector.get_columns('sesi')]
                with db.engine.connect() as conn:
                    if 'user_id' not in sesi_cols:
                        conn.execute(text("ALTER TABLE sesi ADD COLUMN user_id INTEGER REFERENCES user(id)"))
                    if 'is_afk' not in sesi_cols:
                        conn.execute(text("ALTER TABLE sesi ADD COLUMN is_afk BOOLEAN DEFAULT 0"))
                    if 'afk_pin' not in sesi_cols:
                        conn.execute(text("ALTER TABLE sesi ADD COLUMN afk_pin VARCHAR(100)"))
                    if 'afk_sejak' not in sesi_cols:
                        conn.execute(text("ALTER TABLE sesi ADD COLUMN afk_sejak DATETIME"))
                    if 'sesi_asal_id' not in sesi_cols:
                        conn.execute(text("ALTER TABLE sesi ADD COLUMN sesi_asal_id INTEGER REFERENCES sesi(id)"))
                    conn.commit()

            # Auto-migration v1.6.2: ShiftRecord catatan, total_qris, total_refund columns
            if inspector.has_table('shift_record'):
                shift_cols = [c['name'] for c in inspector.get_columns('shift_record')]
                with db.engine.connect() as conn:
                    if 'catatan' not in shift_cols:
                        conn.execute(text("ALTER TABLE shift_record ADD COLUMN catatan VARCHAR(255)"))
                    if 'total_qris' not in shift_cols:
                        conn.execute(text("ALTER TABLE shift_record ADD COLUMN total_qris INTEGER DEFAULT 0"))
                    if 'total_refund' not in shift_cols:
                        conn.execute(text("ALTER TABLE shift_record ADD COLUMN total_refund INTEGER DEFAULT 0"))
                    if 'detail_metode_json' not in shift_cols:
                        conn.execute(text("ALTER TABLE shift_record ADD COLUMN detail_metode_json TEXT"))
                    conn.commit()

            # Auto-migration v1.6.2: Tabel menu_stock_log
            if not inspector.has_table('menu_stock_log'):
                from app.models.menu.menu import MenuStockLog
                MenuStockLog.__table__.create(db.engine)
                app.logger.info("[OK] [TMBilling] Tabel 'menu_stock_log' berhasil dibuat secara otomatis.")
        except Exception as e:
            app.logger.warning(f"Pengecekan bootstrap skema database: {e}")

def create_app(config_override=None):
    """Membuat dan mengkonfigurasi instance aplikasi Flask.
    
    Factory pattern digunakan agar aplikasi bisa diinstansiasi
    beberapa kali dengan konfigurasi berbeda (contoh: testing).
    
    Args:
        config_override (dict, optional): Dictionary konfigurasi untuk menimpa nilai default.

    Returns:
        Flask: Instance aplikasi Flask yang sudah terkonfigurasi lengkap
               dengan semua blueprint, database, dan CORS.
    """
    instance_path = config_override.get("INSTANCE_PATH") if config_override else None
    if instance_path:
        app = Flask(__name__, template_folder='templates', instance_path=instance_path)
    else:
        app = Flask(__name__, template_folder='templates')

    app.config.from_object(Config)
    if config_override:
        app.config.update(config_override)

    # Konfigurasi CORS yang lebih ketat (anti wildcard credential leak)
    raw_origins = os.environ.get('ALLOWED_ORIGINS')
    if raw_origins and raw_origins.strip() != '*':
        allowed_origins = [o.strip() for o in raw_origins.split(',') if o.strip()]
        CORS(app, resources={r"/*": {"origins": allowed_origins}}, supports_credentials=True)
    else:
        allowed_origins = [r"^http://localhost(:\d+)?$", r"^http://127\.0\.0\.1(:\d+)?$"]
        CORS(app, resources={r"/*": {"origins": allowed_origins}}, supports_credentials=True)

    db.init_app(app)

    # IP Whitelist middleware
    from app.middleware import check_ip_whitelist
    app.before_request(check_ip_whitelist)

    csrf.init_app(app)
    migrate.init_app(app, db, render_as_batch=True)

    @app.after_request
    def _isolate_stateless_bearer_sessions(response):
        """Mencegah pencemaran cookie sesi browser pada request API stateless Bearer relay."""
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            from flask import session as flask_sess
            flask_sess.modified = False
            if "Set-Cookie" in response.headers:
                cookie_name = app.config.get("SESSION_COOKIE_NAME", "session")
                cookies = response.headers.getlist("Set-Cookie")
                filtered = [c for c in cookies if not c.strip().startswith(f"{cookie_name}=")]
                response.headers.setlist("Set-Cookie", filtered)
        return response

    @app.after_request
    def _cache_versioned_static_assets(response):
        # Hanya folder aset ber-versi & QRIS (screenshot menimpa nama file yang sama).
        if request.path.startswith(("/static/js/", "/static/css/", "/static/vendor/",
                                    "/static/uploads/qris/")):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response

    os.makedirs("logs", exist_ok=True)

    _register_blueprints(app)
    _register_public_routes(app)
    _register_context_processors(app)
    _init_app_context(app)

    return app
