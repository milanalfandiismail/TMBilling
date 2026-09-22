# app/models/game/game.py

from app.models.base.base import db
from datetime import datetime
from app.models import now_local
from flask import url_for
import os

class Game(db.Model):
    __tablename__ = 'game'

    id = db.Column(db.Integer, primary_key=True)
    nama = db.Column(db.String(255), nullable=False)
    tipe = db.Column(db.String(50), default='game', nullable=True) # 'game' atau 'aplikasi'
    kategori = db.Column(db.String(500), nullable=True) # Ex: FPS, RPG, Action (koma terpisah)
    
    # Path & Arguments
    exe_path = db.Column(db.String(500), nullable=True)
    argumen = db.Column(db.String(500), nullable=True)
    
    # Image icon (filename only, stored in static/uploads/games/)
    icon = db.Column(db.String(255), nullable=True)
    
    # Visibilitas di portal publik
    aktif = db.Column(db.Boolean, default=True)

    created_at = db.Column(db.DateTime, default=now_local)
    updated_at = db.Column(db.DateTime, default=now_local, onupdate=now_local)
    operator_id = db.Column(db.String(50), nullable=True) # Username kasir/admin yang input

    @property
    def icon_url(self):
        """Helper to get full URL for the icon"""
        if self.icon:
            # Assuming files are stored in app/static/uploads/games/
            return f"/static/uploads/games/{self.icon}"
        return None

    def to_dict(self):
        raw_kat = self.kategori or ""
        kat_list = [k.strip() for k in raw_kat.split(",") if k.strip()]
        return {
            "id": self.id,
            "nama": self.nama,
            "tipe": self.tipe or "game",
            "kategori": self.kategori,
            "kategori_list": kat_list,
            "exe_path": self.exe_path,
            "argumen": self.argumen,
            "icon": self.icon,
            "icon_url": self.icon_url,
            "aktif": self.aktif,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "operator_id": self.operator_id
        }

