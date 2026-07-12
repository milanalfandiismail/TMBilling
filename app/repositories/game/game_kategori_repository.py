# app/repositories/game/game_kategori_repository.py

from app.models.base.base import db
from app.models.game.game_kategori import GameKategori

class GameKategoriRepository:
    """Repository class untuk mengelola data Kategori Game."""

    @staticmethod
    def get_all():
        """Mengambil semua kategori."""
        return GameKategori.query.order_by(GameKategori.nama).all()

    @staticmethod
    def get_by_id(kategori_id):
        """Mengambil kategori berdasarkan ID."""
        return GameKategori.query.get(kategori_id)

    @staticmethod
    def get_by_nama(nama):
        """Mengambil kategori berdasarkan nama."""
        return GameKategori.query.filter_by(nama=nama).first()

    @staticmethod
    def save(kategori):
        """Menambahkan atau update data kategori (Tanpa Commit)."""
        db.session.add(kategori)

    @staticmethod
    def delete(kategori):
        """Menghapus kategori (Tanpa Commit)."""
        db.session.delete(kategori)
