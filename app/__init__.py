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

from flask import Flask, current_app, redirect, render_template, request, g, jsonify
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
        vnc_api_bp,
        maintenance_api_bp,
        uptime_api_bp,
        tv_public_api_bp,
        health_api_bp,
        tutorial_api_bp,
        notes_api_bp,
        arsip_api_bp
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
    app.register_blueprint(monitor_kasir_bp, url_prefix="/api/v1/kasir/monitor")
    app.register_blueprint(game_kasir_api_bp, url_prefix="/api/v1/kasir/game")
    app.register_blueprint(vnc_api_bp, url_prefix="/api/v1/kasir/vnc")
    app.register_blueprint(maintenance_api_bp, url_prefix="/api/v1/kasir/maintenance")
    app.register_blueprint(uptime_api_bp, url_prefix="/api/v1/kasir/uptime")
    app.register_blueprint(tutorial_api_bp, url_prefix="/api/v1/kasir/tutorials")
    app.register_blueprint(notes_api_bp, url_prefix="/api/v1/kasir/notes")
    app.register_blueprint(arsip_api_bp, url_prefix="/api/v1/kasir/arsip")

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
        return _render_public_specs_page()

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

        from app.utils.timezone_utils import format_display
        from app.config import Config
        raw_version = current_app.config.get("VERSION", Config.VERSION)
        version_tag = f"v{raw_version}" if not str(raw_version).startswith("v") else str(raw_version)
        v_cache = "".join(c for c in str(raw_version) if c.isdigit()) or Config.get_cache_version()
        return dict(
            warnet_title=title,
            version=version_tag,
            app_version=raw_version,
            v_cache=v_cache,
            format_display=format_display
        )

def bootstrap_app_data(app):
    """Seed data awal & admin. True bila skema sudah ada dan seed dijalankan."""
    with app.app_context():
        from sqlalchemy import inspect
        # DB baru boleh dibuatkan skema; DB ber-Alembic hanya diubah lewat migrasi.
        inspector = inspect(db.engine)
        if not inspector.has_table("user") and not inspector.has_table("alembic_version"):
            db.create_all()
            inspector = inspect(db.engine)
        if not inspector.has_table("user"):
            # Skema belum ada: biarkan init_db.py / run_migration.py yang menyiapkannya.
            return False

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

        return True


def _install_bootstrap_guard(app):
    """Bootstrap data saat skema pertama kali tersedia (mis. test membuat tabel setelah factory)."""

    @app.before_request
    def _ensure_app_bootstrapped():
        if app.config.get("_BOOTSTRAP_DONE"):
            return None
        if bootstrap_app_data(app):
            app.config["_BOOTSTRAP_DONE"] = True
        return None

def _render_public_specs_page():
    """Render halaman /spesifikasi dengan cache 5 detik."""
    import json
    import re
    import time
    from app.models import Grup, PC
    from app.services.cache.client_state_store import OnlineStatusStore
    from sqlalchemy.orm import joinedload, selectinload

    cache = current_app.config.setdefault("_SPECS_CACHE", {"body": None, "expires": 0.0})
    now = time.monotonic()
    if cache["body"] is not None and now < cache["expires"]:
        return cache["body"]

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
        active_pcs = [pc for pc in g.pc_list if pc.aktif]
        if active_pcs:
            g.sorted_pc_list = sorted(active_pcs, key=extract_number)
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
                    "online": OnlineStatusStore.is_online(pc.id, 45),
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

    body = render_template(
        "public/specs/index.html",
        groups=groups_with_pcs,
        specs_catalog_json=json.dumps(specs_catalog),
    )
    cache["body"] = body
    cache["expires"] = now + 5.0
    return body

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

    # Bootstrap data harus jalan sebelum middleware IP whitelist (urutan before_request).
    _install_bootstrap_guard(app)

    # IP Whitelist middleware
    from app.middleware import check_ip_whitelist
    app.before_request(check_ip_whitelist)

    @app.before_request
    def _block_during_restore():
        from app.services import maintenance_mode
        if maintenance_mode.is_active() and request.path.startswith("/api/") and request.path != "/api/health":
            return jsonify({"error": "Server sedang memulihkan database. Coba lagi sebentar."}), 503

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

    # Screenshot lama di static publik dipindah ke folder instance sebelum request pertama.
    # Dilewati saat TESTING agar pembuatan app di test tidak menyentuh berkas upload nyata.
    if not app.config.get("TESTING"):
        from app.routes.monitor.screenshot_routes import migrate_legacy_screenshots
        migrate_legacy_screenshots(app)

    if bootstrap_app_data(app):
        app.config["_BOOTSTRAP_DONE"] = True

    return app
