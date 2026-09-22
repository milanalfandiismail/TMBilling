# app/config.py

"""Konfigurasi aplikasi Flask TMBilling.

Module ini memuat environment variables dari file .env
dan mendefinisikan class Config untuk Flask app factory.
Semua parameter bisa di-override via environment variables.
"""

import os
from dotenv import load_dotenv

# Load .env from current working directory first
load_dotenv()
# Also load/override from the app directory relative to this config file
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'))


class Config:
    """Konfigurasi aplikasi Flask untuk sistem billing warnet.
    
    Attributes:
        SECRET_KEY (str): Kunci rahasia untuk session dan security Flask.
        SQLALCHEMY_DATABASE_URI (str): URI database SQLAlchemy.
        SQLALCHEMY_TRACK_MODIFICATIONS (bool): Flag tracking modifikasi SQLAlchemy.
        SESSION_PERMANENT (bool): Flag session permanent.
        PERMANENT_SESSION_LIFETIME (int): Lifetime session dalam detik (24 jam).
        CLIENT_API_KEY (str): API key untuk autentikasi client C#.
        DEBUG_MODE (bool): Flag mode debug aplikasi.
    """
    
    SECRET_KEY = os.environ.get('SECRET_KEY')
    import sys
    if "pytest" in sys.modules or os.environ.get("FLASK_ENV") == "testing":
        SQLALCHEMY_DATABASE_URI = "sqlite:///test_warnet.db"
    else:
        SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///warnet.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SESSION_PERMANENT = True
    PERMANENT_SESSION_LIFETIME = 86400  # 24 jam
    WTF_CSRF_TIME_LIMIT = None          # CSRF mengikuti umur session agar tidak kedaluwarsa sendiri
    VERSION = "1.6.1"
    VERSION_NAME = "Multi-Branch Nexus"

    @classmethod
    def get_version_tag(cls) -> str:
        """Mengembalikan format versi dengan prefix 'v' (contoh: 'v1.6.1')."""
        return f"v{cls.VERSION}" if not str(cls.VERSION).startswith("v") else str(cls.VERSION)

    @classmethod
    def get_cache_version(cls) -> str:
        """Mengembalikan format numerik versi untuk cache busting URL (contoh: '161' dari '1.6.1')."""
        return "".join(c for c in str(cls.VERSION) if c.isdigit()) or "1"

    # Tambahan untuk kebutuhan aplikasi
    CLIENT_API_KEY = os.environ.get('CLIENT_API_KEY')
    DEBUG_MODE = os.environ.get('DEBUG_MODE', 'False').lower() == 'true'
    BLACKOUT_THRESHOLD_MINUTES = int(os.environ.get('BLACKOUT_THRESHOLD_MINUTES', 60))
    WAITRESS_THREADS = int(os.environ.get('WAITRESS_THREADS', 8))