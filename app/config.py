# app/config.py

"""Konfigurasi aplikasi Flask TMBilling.

Module ini memuat environment variables dari file .env
dan mendefinisikan class Config untuk Flask app factory.
Semua parameter bisa di-override via environment variables.
"""

import os
import re
import secrets
from dotenv import load_dotenv

# Load .env from current working directory first
load_dotenv()
# Also load/override from the app directory relative to this config file
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'))


def get_or_create_secret_key(env_path=None) -> str:
    """Mengambil SECRET_KEY dari env, atau meng-generate kunci acak aman dan menyimpannya ke .env."""
    target_env = env_path or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    INSECURE_DEFAULT = "tm-billing-secret-key-default-2026"

    # Jika file target_env sudah ada, baca kuncinya
    if env_path and os.path.exists(target_env):
        with open(target_env, "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("SECRET_KEY="):
                    val = line.split("=", 1)[1].strip().strip('"').strip("'")
                    if val and val != INSECURE_DEFAULT:
                        return val

    # Jika env_path default, cek os.environ terlebih dahulu
    if not env_path:
        current_key = os.environ.get("SECRET_KEY", "").strip()
        if current_key and current_key != INSECURE_DEFAULT:
            return current_key

    new_key = secrets.token_hex(32)

    try:
        if os.path.exists(target_env):
            with open(target_env, "r", encoding="utf-8") as f:
                content = f.read()
            if "SECRET_KEY=" in content:
                content = re.sub(r"SECRET_KEY=.*", f"SECRET_KEY={new_key}", content)
            else:
                content += f"\nSECRET_KEY={new_key}\n"
        else:
            content = f"SECRET_KEY={new_key}\n"

        with open(target_env, "w", encoding="utf-8") as f:
            f.write(content)
        if not env_path:
            os.environ["SECRET_KEY"] = new_key
    except Exception:
        if not env_path:
            os.environ["SECRET_KEY"] = new_key

    return new_key


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
    
    SECRET_KEY = get_or_create_secret_key()
    import sys
    _is_testing = (
        "pytest" in sys.modules
        or "unittest" in sys.modules
        or any("unittest" in str(arg) for arg in sys.argv)
        or os.environ.get("FLASK_ENV") == "testing"
    )
    if _is_testing:
        SQLALCHEMY_DATABASE_URI = "sqlite:///test_warnet.db"
    else:
        SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///warnet.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SESSION_PERMANENT = True
    PERMANENT_SESSION_LIFETIME = 86400  # 24 jam
    WTF_CSRF_TIME_LIMIT = None          # CSRF mengikuti umur session agar tidak kedaluwarsa sendiri
    VERSION = "1.6.5-rc2"
    VERSION_NAME = "Autonomous Offline Studio"

    @classmethod
    def get_version_tag(cls) -> str:
        """Mengembalikan format versi dengan prefix 'v' (contoh: 'v1.6.5-rc2')."""
        return f"v{cls.VERSION}" if not str(cls.VERSION).startswith("v") else str(cls.VERSION)

    @classmethod
    def get_cache_version(cls) -> str:
        """Mengembalikan format numerik versi untuk cache busting URL (contoh: '163' dari '1.6.3')."""
        return "".join(c for c in str(cls.VERSION) if c.isdigit()) or "1"

    # Tambahan untuk kebutuhan aplikasi
    CLIENT_API_KEY = os.environ.get('CLIENT_API_KEY')
    DEBUG_MODE = os.environ.get('DEBUG_MODE', 'False').lower() == 'true'
    BLACKOUT_THRESHOLD_MINUTES = int(os.environ.get('BLACKOUT_THRESHOLD_MINUTES', 60))
    WAITRESS_THREADS = int(os.environ.get('WAITRESS_THREADS', 8))