# app/repositories/game/game_repository.py

from app.models.base.base import db
from app.models.game.game import Game

class GameRepository:
    """Repository class untuk mengelola data Game."""

    @staticmethod
    def get_all(aktif_only=False, category=None, search_query=None):
        """Mengambil daftar game dengan filter opsional."""
        query = Game.query
        if aktif_only:
            query = query.filter_by(aktif=True)
        if category:
            query = query.filter_by(kategori=category)
        if search_query:
            query = query.filter(
                (Game.nama.ilike(f"%{search_query}%"))
            )
        return query.order_by(Game.nama).all()

    @staticmethod
    def get_by_id(game_id):
        """Mengambil game berdasarkan ID."""
        return Game.query.get(game_id)

    @staticmethod
    def get_by_nama(nama):
        """Mengambil game berdasarkan nama (unik)."""
        return Game.query.filter_by(nama=nama).first()

    @staticmethod
    def save(game):
        """Menambahkan atau update data game (Tanpa Commit)."""
        db.session.add(game)

    @staticmethod
    def delete(game):
        """Menghapus game (Tanpa Commit)."""
        db.session.delete(game)
