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
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///warnet.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SESSION_PERMANENT = True
    PERMANENT_SESSION_LIFETIME = 86400  # 24 jam
    WTF_CSRF_TIME_LIMIT = None          # CSRF mengikuti umur session agar tidak kedaluwarsa sendiri
    VERSION = "v1.1.5"                  # Versi aplikasi (update manual setiap rilis)

    # Tambahan untuk kebutuhan aplikasi
    CLIENT_API_KEY = os.environ.get('CLIENT_API_KEY')
    DEBUG_MODE = os.environ.get('DEBUG_MODE', 'False').lower() == 'true'
    BLACKOUT_THRESHOLD_MINUTES = int(os.environ.get('BLACKOUT_THRESHOLD_MINUTES', 60))
    WAITRESS_THREADS = int(os.environ.get('WAITRESS_THREADS', 8))