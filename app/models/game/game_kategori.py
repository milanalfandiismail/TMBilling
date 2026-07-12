# app/models/game/game_kategori.py

from app.models.base.base import db
from datetime import datetime
from app.models import now_local

class GameKategori(db.Model):
    __tablename__ = 'game_kategori'

    id = db.Column(db.Integer, primary_key=True)
    nama = db.Column(db.String(100), nullable=False, unique=True)
    created_at = db.Column(db.DateTime, default=now_local)
    updated_at = db.Column(db.DateTime, default=now_local, onupdate=now_local)

    def to_dict(self):
        return {
            "id": self.id,
            "nama": self.nama
        }
