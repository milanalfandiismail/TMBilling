# app/repositories/game/game_repository.py

from app.models.base.base import db
from app.models.game.game import Game

class GameRepository:
    @staticmethod
    def get_all(aktif_only=False, category=None, search_query=None):
        query = Game.query
        
        if aktif_only:
            query = query.filter_by(aktif=True)
            
        if category and category.lower() != 'all':
            query = query.filter(Game.kategori.ilike(category))
            
        if search_query:
            query = query.filter(Game.nama.ilike(f"%{search_query}%"))
            
        return query.order_by(Game.nama).all()

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
