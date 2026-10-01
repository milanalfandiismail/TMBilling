# app/services/game/game_service.py

import os
from werkzeug.utils import secure_filename
from app.repositories.game.game_repository import GameRepository
from app.models.game.game import Game
from app.utils.logger import write_log

from app.utils.validators import validate_string_length, validate_choice, validate_filename

UPLOAD_FOLDER = os.path.join('app', 'static', 'uploads', 'games')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'ico', 'svg'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

class GameService:
    @staticmethod
    def _save_icon(icon_file):
        if not icon_file or not icon_file.filename:
            return None
            
        clean_filename = validate_filename(icon_file.filename, allowed_extensions=ALLOWED_EXTENSIONS, field_name="Icon Game")
            
        if not os.path.exists(UPLOAD_FOLDER):
            os.makedirs(UPLOAD_FOLDER)
            
        filename = secure_filename(clean_filename)
        # Tambahkan timestamp agar unik
        import time
        unique_filename = f"{int(time.time())}_{filename}"
        filepath = os.path.join(UPLOAD_FOLDER, unique_filename)
        icon_file.save(filepath)
        return unique_filename

    @staticmethod
    def _delete_icon_file(icon_filename):
        """Menghapus file fisik icon/cover game dari disk secara aman."""
        if not icon_filename or not isinstance(icon_filename, str):
            return
        try:
            filename = os.path.basename(icon_filename.replace("\\", "/"))
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            if os.path.exists(filepath):
                os.remove(filepath)
        except Exception:
            pass

    @staticmethod
    def _normalize_kategori(kat_val):
        if not kat_val:
            return None
        if isinstance(kat_val, list):
            items = [validate_string_length(str(k), min_len=1, max_len=50, field_name="Kategori Game", required=False) for k in kat_val if str(k).strip()]
            return ", ".join(items) if items else None
        elif isinstance(kat_val, str):
            items = [validate_string_length(k, min_len=1, max_len=50, field_name="Kategori Game", required=False) for k in kat_val.split(",") if k.strip()]
            return ", ".join(items) if items else None
        return str(kat_val)

    @staticmethod
    def get_all(aktif_only=False, category=None, tipe=None, search_query=None):
        return GameRepository.get_all(aktif_only=aktif_only, category=category, tipe=tipe, search_query=search_query)

    @staticmethod
    def create(data, icon_file=None, operator=None):
        raw_nama = data.get("nama")
        nama = validate_string_length(raw_nama, min_len=2, max_len=100, field_name="Nama Game/Aplikasi", required=True)
            
        icon_filename = GameService._save_icon(icon_file)
        kategori_str = GameService._normalize_kategori(data.get("kategori"))
        tipe_val = validate_choice(data.get("tipe") or "game", ["game", "aplikasi"], field_name="Tipe Game", case_sensitive=False)
        exe_path = validate_string_length(data.get("exe_path"), min_len=1, max_len=255, field_name="Executable Path", required=False) if data.get("exe_path") else None
        argumen = validate_string_length(data.get("argumen"), min_len=1, max_len=255, field_name="Argumen Eksekusi", required=False) if data.get("argumen") else None
        
        game = Game(
            nama=nama,
            tipe=tipe_val,
            kategori=kategori_str,
            exe_path=exe_path,
            argumen=argumen,
            icon=icon_filename,
            aktif=bool(data.get("aktif", True))
        )
        if operator:
            game.operator_id = operator
            
        result = GameRepository.add(game)
        op_name = operator if isinstance(operator, str) else "admin"
        write_log(
            "GAME_CREATE",
            f"Item '{nama}' ({tipe_val}) berhasil ditambahkan ke katalog",
            user=op_name,
            detail_json={"nama": game.nama, "tipe": game.tipe, "kategori": game.kategori, "exe_path": game.exe_path, "argumen": game.argumen}
        )
        return result

    @staticmethod
    def update(game_id, data, icon_file=None, operator=None):
        game = GameRepository.get_by_id(game_id)
        if not game:
            raise ValueError("Data game/aplikasi tidak ditemukan")
            
        old_nama = game.nama
        old_kategori = game.kategori
        old_tipe = getattr(game, "tipe", "game")
        
        if "nama" in data and data["nama"] is not None:
            game.nama = validate_string_length(data["nama"], min_len=2, max_len=100, field_name="Nama Game/Aplikasi", required=True)
        if "tipe" in data and data["tipe"] is not None:
            game.tipe = validate_choice(data["tipe"], ["game", "aplikasi"], field_name="Tipe Game", case_sensitive=False)
        if "kategori" in data and data["kategori"] is not None:
            game.kategori = GameService._normalize_kategori(data["kategori"])
        if "exe_path" in data and data["exe_path"] is not None:
            game.exe_path = validate_string_length(data["exe_path"], min_len=1, max_len=255, field_name="Executable Path", required=False) if str(data["exe_path"]).strip() else None
        if "argumen" in data and data["argumen"] is not None:
            game.argumen = validate_string_length(data["argumen"], min_len=1, max_len=255, field_name="Argumen Eksekusi", required=False) if str(data["argumen"]).strip() else None
        if "aktif" in data:
            val = data["aktif"]
            game.aktif = str(val).lower() in ("true", "1", "yes")

        # Cek apakah icon dihapus atau diganti
        hapus_icon = data.get("hapus_icon") == "true" or data.get("hapus_icon") is True
        if hapus_icon:
            if game.icon:
                GameService._delete_icon_file(game.icon)
                game.icon = None
        elif icon_file and icon_file.filename:
            if game.icon:
                GameService._delete_icon_file(game.icon)
            new_icon = GameService._save_icon(icon_file)
            if new_icon:
                game.icon = new_icon

        if operator:
            game.operator_id = operator
            
        result = GameRepository.update(game)
        op_name = operator if isinstance(operator, str) else "admin"
        write_log(
            "GAME_UPDATE",
            f"Item '{old_nama}' berhasil diperbarui",
            user=op_name,
            detail_json={
                "nama_sebelum": old_nama, "nama_baru": game.nama,
                "tipe_sebelum": old_tipe, "tipe_baru": game.tipe,
                "kategori_sebelum": old_kategori, "kategori_baru": game.kategori,
                "exe_path": game.exe_path
            }
        )
        return result

    @staticmethod
    def delete(game_id, operator=None):
        game = GameRepository.get_by_id(game_id)
        if not game:
            raise ValueError("Game tidak ditemukan")
            
        # Hapus file icon jika ada
        if game.icon:
            GameService._delete_icon_file(game.icon)
                    
        GameRepository.delete(game)
        op_name = operator if isinstance(operator, str) else "admin"
        write_log(
            "GAME_DELETE",
            f"Game '{game.nama}' berhasil dihapus dari katalog",
            user=op_name,
            detail_json={"nama": game.nama, "kategori": game.kategori}
        )
        return {"success": True, "message": f"Game '{game.nama}' berhasil dihapus"}
