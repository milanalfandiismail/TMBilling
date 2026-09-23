# app/services/game/game_kategori_service.py

from app.repositories.game.game_kategori_repository import GameKategoriRepository
from app.models.game.game_kategori import GameKategori
from app.utils.validators import validate_string_length

class GameKategoriService:
    @staticmethod
    def get_all():
        return GameKategoriRepository.get_all()

    @staticmethod
    def create(data, operator=None):
        nama = validate_string_length(data.get("nama"), min_len=2, max_len=50, field_name="Nama Kategori Game", required=True)
            
        existing = GameKategoriRepository.get_by_nama(nama)
        if existing:
            raise ValueError(f"Kategori '{nama}' sudah ada")
            
        kategori = GameKategori(nama=nama)
        return GameKategoriRepository.add(kategori)

    @staticmethod
    def delete(kategori_id, operator=None):
        kategori = GameKategoriRepository.get_by_id(kategori_id)
        if not kategori:
            raise ValueError("Kategori tidak ditemukan")
            
        GameKategoriRepository.delete(kategori)
        return {"success": True, "message": "Kategori berhasil dihapus"}
