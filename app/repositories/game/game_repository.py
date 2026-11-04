# app/repositories/game/game_repository.py

from app.models.base.base import db
from app.models.game.game import Game

class GameRepository:
    @staticmethod
    def get_all(aktif_only=False, category=None, tipe=None, search_query=None, limit=None, offset=0):
        query = Game.query
        
        if aktif_only:
            query = query.filter_by(aktif=True)
            
        if tipe and tipe.lower() != 'all':
            query = query.filter(Game.tipe == tipe.lower())
            
        if category and category.lower() != 'all':
            query = query.filter(Game.kategori.ilike(f"%{category}%"))
            
        if search_query:
            query = query.filter(
                db.or_(
                    Game.nama.ilike(f"%{search_query}%"),
                    Game.kategori.ilike(f"%{search_query}%")
                )
            )
            
        query = query.order_by(Game.nama)
        # Pagination hanya aktif bila nilainya valid, agar default tetap mengembalikan semua data.
        if offset and offset > 0:
            query = query.offset(offset)
        if limit and limit > 0:
            query = query.limit(limit)
        return query.all()

    @staticmethod
    def get_by_id(game_id):
        return Game.query.get(game_id)

    @staticmethod
    def add(game):
        db.session.add(game)
        db.session.commit()
        return game

    @staticmethod
    def update(game):
        db.session.commit()
        return game

    @staticmethod
    def delete(game):
        db.session.delete(game)
        db.session.commit()
