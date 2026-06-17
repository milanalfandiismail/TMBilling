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

from flask import Flask, redirect, render_template
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

    os.makedirs("logs", exist_ok=True)

    # Import dan registrasi blueprints
    from app.routes import (
        auth_bp,
        auth_kasir_bp,
        blackout_bp,
        client_bp,
        dashboard_bp,
        member_bp,
        paket_bp,
        pc_bp,
        report_bp,
        sesi_bp,
        grup_bp,
        settings_bp,
        monitor_bp,
        user_bp,
        menu_bp,
        backup_bp,
        tournament_bp,
        member_portal_bp,
        shift_bp
    )

    app.register_blueprint(dashboard_bp, url_prefix="/kasir")
    app.register_blueprint(backup_bp)
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(auth_kasir_bp, url_prefix="/api/kasir")
    app.register_blueprint(client_bp, url_prefix="/client")
    app.register_blueprint(member_portal_bp)
    
    # Kecualikan komunikasi Client dari proteksi CSRF (Pakai API Key / Token)
    csrf.exempt(client_bp)
    csrf.exempt(auth_bp)
    csrf.exempt(monitor_bp)
    csrf.exempt(shift_bp)
    
    app.register_blueprint(member_bp, url_prefix="/api")
    app.register_blueprint(paket_bp, url_prefix="/api/paket")
    app.register_blueprint(pc_bp, url_prefix="/api")
    app.register_blueprint(report_bp, url_prefix="/api/report")
    app.register_blueprint(sesi_bp, url_prefix="/api/sesi")
    app.register_blueprint(grup_bp, url_prefix="/api/grup")
    app.register_blueprint(blackout_bp, url_prefix="/api/blackout")
    app.register_blueprint(settings_bp, url_prefix="/api")
    app.register_blueprint(monitor_bp, url_prefix="/api")
    app.register_blueprint(user_bp, url_prefix="/api/user")
    app.register_blueprint(menu_bp, url_prefix="/api")
    app.register_blueprint(tournament_bp, url_prefix="/api")
    app.register_blueprint(shift_bp, url_prefix="/api")

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
        warnet_rules = SettingsService.get("warnet_rules", default_rules)
        return render_template("public/landing/index.html", warnet_rules=warnet_rules)

    @app.route("/livepc")
    def public_pc_map():
        """Render halaman khusus peta PC live."""
        return render_template("public/livepc/index.html")

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
        from app.models import Grup
        groups = Grup.query.all()
        # Ambil grup yang memiliki PC terdaftar
        groups_with_pcs = [g for g in groups if len(g.pc_list) > 0]
        return render_template("public/specs/index.html", groups=groups_with_pcs)

    @app.context_processor
    def inject_global_settings():
        try:
            from app.services import SettingsService
            title = SettingsService.get("warnet_title", "TMBilling")
        except Exception:
            title = "TMBilling"
        return dict(warnet_title=title)

    with app.app_context():
        db.create_all()
        
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
