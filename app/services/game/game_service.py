# app/services/game/game_service.py

import os
from werkzeug.utils import secure_filename
from app.repositories.game.game_repository import GameRepository
from app.models.game.game import Game

UPLOAD_FOLDER = os.path.join('app', 'static', 'uploads', 'games')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

class GameService:
    @staticmethod
    def _save_icon(icon_file):
        if not icon_file or not icon_file.filename:
            return None
            
        if not allowed_file(icon_file.filename):
            raise ValueError("Format file icon tidak diizinkan. Gunakan .png, .jpg, atau .webp")
            
        if not os.path.exists(UPLOAD_FOLDER):
            os.makedirs(UPLOAD_FOLDER)
            
        filename = secure_filename(icon_file.filename)
        # Tambahkan timestamp agar unik
        import time
        unique_filename = f"{int(time.time())}_{filename}"
        filepath = os.path.join(UPLOAD_FOLDER, unique_filename)
        icon_file.save(filepath)
        return unique_filename

    @staticmethod
    def get_all(aktif_only=False, category=None, search_query=None):
        return GameRepository.get_all(aktif_only, category, search_query)

    @staticmethod
    def create(data, icon_file=None, operator=None):
        nama = data.get("nama")
        if not nama:
            raise ValueError("Nama game wajib diisi")
            
        icon_filename = GameService._save_icon(icon_file)
        
        game = Game(
            nama=nama,
            kategori=data.get("kategori"),
            exe_path=data.get("exe_path"),
            argumen=data.get("argumen"),
            icon=icon_filename,
            aktif=data.get("aktif", True)
        )
        if operator:
            game.operator_id = operator
            
        return GameRepository.add(game)

    @staticmethod
    def update(game_id, data, icon_file=None, operator=None):
        game = GameRepository.get_by_id(game_id)
        if not game:
            raise ValueError("Game tidak ditemukan")
            
        if "nama" in data and not data["nama"]:
            raise ValueError("Nama game tidak boleh kosong")
            
        if "nama" in data: game.nama = data["nama"]
        if "kategori" in data: game.kategori = data["kategori"]
        if "exe_path" in data: game.exe_path = data["exe_path"]
        if "argumen" in data: game.argumen = data["argumen"]
        if "aktif" in data:
            val = data["aktif"]
            game.aktif = str(val).lower() in ("true", "1", "yes")

        if icon_file and icon_file.filename:
            new_icon = GameService._save_icon(icon_file)
            if new_icon:
                game.icon = new_icon

        if operator:
            game.operator_id = operator
            
        return GameRepository.update(game)

    @staticmethod
    def delete(game_id, operator=None):
        game = GameRepository.get_by_id(game_id)
        if not game:
            raise ValueError("Game tidak ditemukan")
            
        # Hapus file icon jika ada
        if game.icon:
            filepath = os.path.join(UPLOAD_FOLDER, game.icon)
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                except:
                    pass
                    
        GameRepository.delete(game)
        return {"success": True, "message": f"Game '{game.nama}' berhasil dihapus"}
