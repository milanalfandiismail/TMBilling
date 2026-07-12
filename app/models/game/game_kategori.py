# app/models/game/game_kategori.py

from app.models.base.base import db

class GameKategori(db.Model):
    """Model untuk daftar kategori game.
    
    Attributes:
        id (int): Primary key.
        nama (str): Nama kategori (unik).
    """
    __tablename__ = "game_kategori"

    id = db.Column(db.Integer, primary_key=True)
    nama = db.Column(db.String(50), nullable=False, unique=True)

    def to_dict(self):
        return {
            "id": self.id,
            "nama": self.nama
        }
