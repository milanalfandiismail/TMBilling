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

from flask import Flask, redirect
from flask_cors import CORS
import os

from flask_migrate import Migrate
from flask_wtf import CSRFProtect
from app.models.base import db
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
        menu_bp
    )

    app.register_blueprint(dashboard_bp, url_prefix="/kasir")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(auth_kasir_bp, url_prefix="/api/kasir")
    app.register_blueprint(client_bp, url_prefix="/client")
    
    # Kecualikan komunikasi Client dari proteksi CSRF (Pakai API Key / Token)
    csrf.exempt(client_bp)
    csrf.exempt(auth_bp)
    csrf.exempt(monitor_bp)
    
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

    @app.route("/")
    def index():
        """Redirect root URL to login page."""
        return redirect("/kasir/login")

    with app.app_context():
        db.create_all()

    return app
