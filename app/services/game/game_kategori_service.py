# app/services/game/game_kategori_service.py

from app.repositories.game.game_kategori_repository import GameKategoriRepository
from app.models.game.game_kategori import GameKategori

class GameKategoriService:
    @staticmethod
    def get_all():
        return GameKategoriRepository.get_all()

    @staticmethod
    def create(data, operator=None):
        nama = data.get("nama")
        if not nama:
            raise ValueError("Nama kategori wajib diisi")
            
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
