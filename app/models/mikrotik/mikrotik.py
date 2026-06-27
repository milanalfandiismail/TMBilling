from app.models.base.base import db, now_local

class MikroTikConfig(db.Model):
    """Model konfigurasi MikroTik Hotspot.
    
    Hanya akan ada 1 baris di tabel ini (Singleton pattern).
    """
    __tablename__ = "mikrotik_config"
    
    id = db.Column(db.Integer, primary_key=True)
    enabled = db.Column(db.Boolean, default=False, nullable=False)
    host = db.Column(db.String(100), nullable=True)
    port = db.Column(db.Integer, default=8728, nullable=False)
    username = db.Column(db.String(100), nullable=True)
    password = db.Column(db.String(255), nullable=True)
    hotspot_profile = db.Column(db.String(100), default="default", nullable=False)
    updated_at = db.Column(db.DateTime, default=now_local, onupdate=now_local)

    @classmethod
    def get_instance(cls):
        """Mengambil konfigurasi, jika belum ada buat default-nya."""
        instance = cls.query.first()
        if not instance:
            instance = cls(
                enabled=False,
                host="",
                port=8728,
                username="",
                password="",
                hotspot_profile="default"
            )
            db.session.add(instance)
            db.session.commit()
        return instance
