"""Model untuk pengaturan/konfigurasi sistem yang disimpan di database.

Module ini menyediakan model key-value store sederhana untuk menyimpan
parameter sistem seperti timer auto-shutdown, threshold blackout, dll.
Memungkinkan perubahan konfigurasi tanpa restart aplikasi.
"""

from app.models import db, now_local


class Settings(db.Model):
    """Model key-value store untuk konfigurasi sistem.
    
    Menyimpan pengaturan aplikasi dalam format key-value pair
    yang bisa diubah secara runtime tanpa perlu restart server.
    
    Attributes:
        id (int): Primary key setting.
        key (str): Kunci unik pengaturan (contoh: 'auto_shutdown_timer_seconds').
        value (str): Nilai pengaturan dalam bentuk string.
        updated_at (datetime): Timestamp update terakhir.
    """
    
    __tablename__ = "settings"
    
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False)
    value = db.Column(db.String(500), nullable=False)
    updated_at = db.Column(db.DateTime, default=now_local, onupdate=now_local)
