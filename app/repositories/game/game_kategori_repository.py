# app/repositories/game/game_kategori_repository.py

from app.models.base.base import db
from app.models.game.game_kategori import GameKategori

class GameKategoriRepository:
    @staticmethod
    def get_all():
        return GameKategori.query.order_by(GameKategori.nama).all()

    @staticmethod
    def get_by_id(kategori_id):
        return GameKategori.query.get(kategori_id)
        
    @staticmethod
    def get_by_nama(nama):
        return GameKategori.query.filter(GameKategori.nama.ilike(nama)).first()

    @staticmethod
    def add(kategori):
        db.session.add(kategori)
        db.session.commit()
        return kategori

    @staticmethod
    def delete(kategori):
        db.session.delete(kategori)
        db.session.commit()
