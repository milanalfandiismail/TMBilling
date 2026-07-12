# app/services/game/game_kategori_service.py

from app.models.base.base import db
from app.models.game.game_kategori import GameKategori
from app.repositories.game.game_kategori_repository import GameKategoriRepository
from app.utils.logger import write_log

class GameKategoriService:
    """Service class untuk mengelola logika bisnis Kategori Game."""

    @staticmethod
    def get_all():
        """Mengambil semua kategori."""
        return GameKategoriRepository.get_all()

    @staticmethod
    def get_by_id(kategori_id):
        """Mengambil kategori berdasarkan ID."""
        kategori = GameKategoriRepository.get_by_id(kategori_id)
        if not kategori:
            raise ValueError("Kategori tidak ditemukan")
        return kategori

    @staticmethod
    def create(data, operator="system"):
        """Membuat kategori baru."""
        nama = data.get("nama", "").strip()
        if not nama:
            raise ValueError("Nama kategori wajib diisi")

        if GameKategoriRepository.get_by_nama(nama):
            raise ValueError(f"Kategori '{nama}' sudah ada")

        kategori = GameKategori(nama=nama)
        GameKategoriRepository.save(kategori)
        db.session.commit()

        write_log("TAMBAH_KATEGORI", f"Kategori Game '{nama}' ditambahkan", user=operator)
        return kategori

    @staticmethod
    def delete(kategori_id, operator="system"):
        """Menghapus kategori."""
        kategori = GameKategoriRepository.get_by_id(kategori_id)
        if not kategori:
            raise ValueError("Kategori tidak ditemukan")

        nama = kategori.nama
        GameKategoriRepository.delete(kategori)
        db.session.commit()

        write_log("HAPUS_KATEGORI", f"Kategori Game '{nama}' dihapus", user=operator)
        return {"success": True, "message": f"Kategori {nama} dihapus"}
