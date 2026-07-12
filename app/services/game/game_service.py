# app/services/game/game_service.py

import os
from flask import current_app
from werkzeug.utils import secure_filename
from app.models.base.base import db
from app.models.game.game import Game
from app.repositories.game.game_repository import GameRepository
from app.utils.logger import write_log

class GameService:
    """Service class untuk mengelola logika bisnis Game."""

    @staticmethod
    def get_all(aktif_only=False, category=None, search_query=None):
        """Mengambil semua game."""
        return GameRepository.get_all(aktif_only, category, search_query)

    @staticmethod
    def get_by_id(game_id):
        """Mengambil game berdasarkan ID."""
        game = GameRepository.get_by_id(game_id)
        if not game:
            raise ValueError("Game tidak ditemukan")
        return game

    @staticmethod
    def create(data, icon_file=None, operator="system"):
        """Membuat game baru."""
        nama = data.get("nama", "").strip()
        if not nama:
            raise ValueError("Nama game wajib diisi")

        if GameRepository.get_by_nama(nama):
            raise ValueError(f"Game dengan nama '{nama}' sudah ada")

        kategori = data.get("kategori", "Casual").strip()
        status = data.get("status", "Ready").strip()
        exe_path = data.get("exe_path", "").strip() or None
        argumen = data.get("argumen", "").strip() or None
        deskripsi = data.get("deskripsi", "").strip() or None
        developer = data.get("developer", "").strip() or None
        file_size = data.get("file_size", "").strip() or None
        aktif = data.get("aktif", True)
        if isinstance(aktif, str):
            aktif = aktif.lower() in ("true", "1", "yes")

        icon_url = None
        if icon_file:
            icon_url = GameService.save_icon(icon_file, nama)

        game = Game(
            nama=nama,
            kategori=kategori,
            status=status,
            exe_path=exe_path,
            argumen=argumen,
            icon_url=icon_url,
            deskripsi=deskripsi,
            developer=developer,
            file_size=file_size,
            aktif=aktif
        )

        GameRepository.save(game)
        db.session.commit()

        write_log("TAMBAH_GAME", f"Game '{nama}' ({kategori}) berhasil ditambahkan", user=operator)
        return game

    @staticmethod
    def update(game_id, data, icon_file=None, operator="system"):
        """Memperbarui data game."""
        game = GameRepository.get_by_id(game_id)
        if not game:
            raise ValueError("Game tidak ditemukan")

        nama = data.get("nama", "").strip()
        if nama and nama != game.nama:
            if GameRepository.get_by_nama(nama):
                raise ValueError(f"Game dengan nama '{nama}' sudah ada")
            game.nama = nama

        if "kategori" in data:
            game.kategori = data["kategori"].strip()
        if "status" in data:
            game.status = data["status"].strip()
        if "exe_path" in data:
            game.exe_path = data["exe_path"].strip() or None
        if "argumen" in data:
            game.argumen = data["argumen"].strip() or None
        if "deskripsi" in data:
            game.deskripsi = data["deskripsi"].strip() or None
        if "developer" in data:
            game.developer = data["developer"].strip() or None
        if "file_size" in data:
            game.file_size = data["file_size"].strip() or None
        if "aktif" in data:
            aktif_val = data["aktif"]
            if isinstance(aktif_val, str):
                game.aktif = aktif_val.lower() in ("true", "1", "yes")
            else:
                game.aktif = bool(aktif_val)

        if icon_file:
            # Hapus icon lama jika ada
            if game.icon_url:
                old_path = os.path.join(current_app.root_path, game.icon_url.lstrip('/'))
                if os.path.exists(old_path):
                    try:
                        os.remove(old_path)
                    except Exception:
                        pass
            game.icon_url = GameService.save_icon(icon_file, game.nama)

        db.session.commit()
        write_log("EDIT_GAME", f"Data game '{game.nama}' diperbarui", user=operator)
        return game

    @staticmethod
    def delete(game_id, operator="system"):
        """Menghapus game."""
        game = GameRepository.get_by_id(game_id)
        if not game:
            raise ValueError("Game tidak ditemukan")

        nama = game.nama
        # Hapus icon file jika ada
        if game.icon_url:
            icon_path = os.path.join(current_app.root_path, game.icon_url.lstrip('/'))
            if os.path.exists(icon_path):
                try:
                    os.remove(icon_path)
                except Exception:
                    pass

        GameRepository.delete(game)
        db.session.commit()

        write_log("HAPUS_GAME", f"Game '{nama}' berhasil dihapus secara permanen", user=operator)
        return {"success": True, "message": f"Game {nama} berhasil dihapus"}

    @staticmethod
    def save_icon(icon_file, game_nama):
        """Menyimpan file icon game secara lokal ke folder static/uploads/game_icons."""
        try:
            upload_dir = os.path.join(current_app.root_path, 'static', 'uploads', 'game_icons')
            if not os.path.exists(upload_dir):
                os.makedirs(upload_dir, exist_ok=True)

            # Generate nama file aman
            ext = os.path.splitext(icon_file.filename)[1]
            safe_name = secure_filename(game_nama.lower().replace(' ', '_')) + ext
            file_path = os.path.join(upload_dir, safe_name)
            
            icon_file.save(file_path)
            
            # Return path relatif untuk disimpan di database
            return f"/static/uploads/game_icons/{safe_name}"
        except Exception as e:
            raise ValueError(f"Gagal menyimpan file icon: {str(e)}")
