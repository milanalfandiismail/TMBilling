# app/services/fileexplorer/fileexplorer_service.py
import os
import json
import shutil
import tempfile
import pathlib
from app.services.settings.settings_service import SettingsService

class FileExplorerService:
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

    @staticmethod
    def get_allowed_roots() -> list[str]:
        """Mengambil daftar direktori yang diizinkan untuk dijelajahi."""
        raw_roots = SettingsService.get("file_explorer_allowed_roots")
        if raw_roots:
            try:
                roots = json.loads(raw_roots)
                if isinstance(roots, list):
                    return [os.path.realpath(p) for p in roots]
            except Exception:
                pass
        
        # Default: direktori root instalasi TMBilling
        default_root = os.path.realpath(os.getcwd())
        return [default_root]

    @staticmethod
    def set_allowed_roots(roots: list[str]) -> list[str]:
        """Menyimpan daftar baru direktori yang diizinkan."""
        clean_roots = [os.path.realpath(p) for p in roots if os.path.exists(p)]
        SettingsService.set("file_explorer_allowed_roots", json.dumps(clean_roots))
        return clean_roots

    @staticmethod
    def validate_path(target_path: str) -> str:
        """
        Validasi path untuk memastikan berada di dalam batasan Allowed Roots.
        Mengembalikan path absolut kanonikal yang valid.
        """
        if not target_path:
            raise ValueError("Path tidak boleh kosong")
            
        canonical_target = os.path.realpath(target_path)
        allowed_roots = FileExplorerService.get_allowed_roots()
        
        for root in allowed_roots:
            # Pastikan target berawalan dari root (dan hindari substring matching parsial)
            root_path = pathlib.Path(root)
            target_path_obj = pathlib.Path(canonical_target)
            
            try:
                # Periksa apakah target_path_obj berada di bawah root_path
                target_path_obj.relative_to(root_path)
                return canonical_target
            except ValueError:
                # Jika target_path_obj bukan di bawah root_path, loop berlanjut
                continue
                
        raise PermissionError(f"Akses ditolak: Path berada di luar batasan direktori yang diizinkan.")

    @staticmethod
    def list_directory(dir_path: str = None) -> dict:
        """Menampilkan daftar isi direktori."""
        try:
            if not dir_path:
                allowed_roots = FileExplorerService.get_allowed_roots()
                dir_path = allowed_roots[0]

            canonical_path = FileExplorerService.validate_path(dir_path)
            if not os.path.isdir(canonical_path):
                return {"success": False, "error": "Path bukan merupakan direktori"}

            items = []
            for entry in os.scandir(canonical_path):
                try:
                    stat = entry.stat()
                    items.append({
                        "name": entry.name,
                        "path": os.path.realpath(entry.path),
                        "is_dir": entry.is_dir(),
                        "size": stat.st_size if entry.is_file() else None,
                        "modified": int(stat.st_mtime),
                        "editable": entry.is_file()
                    })
                except Exception:
                    continue

            return {
                "success": True,
                "current_path": canonical_path,
                "items": sorted(items, key=lambda x: (not x["is_dir"], x["name"].lower()))
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    @staticmethod
    def read_file(file_path: str) -> dict:
        """Membaca konten teks suatu berkas."""
        try:
            canonical_path = FileExplorerService.validate_path(file_path)
            if not os.path.isfile(canonical_path):
                return {"success": False, "error": "Path bukan merupakan berkas", "editable": False}

            stat = os.stat(canonical_path)
            size = stat.st_size
            mtime = stat.st_mtime

            # Proteksi ukuran berkas raksasa
            if size > FileExplorerService.MAX_FILE_SIZE:
                return {
                    "success": False,
                    "error": f"Berkas terlalu besar ({size / 1024 / 1024:.2f} MB) melebihi batas ukuran 5 MB.",
                    "editable": False
                }

            # Deteksi file biner (null byte scan)
            is_binary = False
            with open(canonical_path, "rb") as f:
                chunk = f.read(8000)
                if b"\x00" in chunk:
                    is_binary = True

            if is_binary:
                return {
                    "success": False,
                    "error": "Gagal membaca: Berkas terdeteksi biner.",
                    "editable": False
                }

            # Coba decode dengan UTF-8, fallback ke Latin-1
            try:
                with open(canonical_path, "r", encoding="utf-8") as f:
                    content = f.read()
            except UnicodeDecodeError:
                with open(canonical_path, "r", encoding="latin-1") as f:
                    content = f.read()

            return {
                "success": True,
                "path": canonical_path,
                "content": content,
                "size": size,
                "mtime": mtime,
                "editable": True
            }
        except Exception as e:
            return {"success": False, "error": str(e), "editable": False}

    @staticmethod
    def save_file(file_path: str, content: str, expected_mtime: float = None, force: bool = False) -> dict:
        """Menyimpan berkas secara atomik dengan deteksi konflik mtime."""
        try:
            canonical_path = FileExplorerService.validate_path(file_path)
            if os.path.exists(canonical_path) and not os.path.isfile(canonical_path):
                return {"success": False, "error": "Path bukan merupakan berkas"}

            # Verifikasi konflik konkurensi (Optimistic Locking)
            if os.path.exists(canonical_path) and expected_mtime is not None and not force:
                current_mtime = os.path.getmtime(canonical_path)
                # Beri toleransi selisih mtime kecil (0.01 detik)
                if abs(current_mtime - expected_mtime) > 0.01:
                    return {
                        "success": False,
                        "error": "Conflict: Berkas telah diubah oleh pihak lain di disk. Silakan refresh dan simpan ulang."
                    }

            # Tulis atomik ke temporary file
            dir_name = os.path.dirname(canonical_path)
            with tempfile.NamedTemporaryFile("w", dir=dir_name, delete=False, encoding="utf-8") as temp_file:
                temp_file.write(content)
                temp_path = temp_file.name

            try:
                os.replace(temp_path, canonical_path)
            except Exception as e:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                raise e

            new_mtime = os.path.getmtime(canonical_path)
            return {
                "success": True,
                "path": canonical_path,
                "mtime": new_mtime
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    @staticmethod
    def create_item(parent_path: str, name: str, is_dir: bool = False) -> dict:
        """Membuat berkas kosong atau folder baru."""
        try:
            canonical_parent = FileExplorerService.validate_path(parent_path)
            if not os.path.isdir(canonical_parent):
                return {"success": False, "error": "Direktori induk tidak valid"}

            # Proteksi invalid characters nama berkas
            if not name or "/" in name or "\\" in name:
                return {"success": False, "error": "Nama berkas/folder tidak valid"}

            target_path = os.path.join(canonical_parent, name)
            canonical_target = FileExplorerService.validate_path(target_path)

            if os.path.exists(canonical_target):
                return {"success": False, "error": "Berkas atau folder dengan nama tersebut sudah ada"}

            if is_dir:
                os.makedirs(canonical_target, exist_ok=True)
            else:
                with open(canonical_target, "w", encoding="utf-8") as f:
                    f.write("")

            return {
                "success": True,
                "path": canonical_target
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    @staticmethod
    def rename_item(target_path: str, new_name: str) -> dict:
        """Mengganti nama berkas atau folder."""
        try:
            canonical_target = FileExplorerService.validate_path(target_path)
            if not os.path.exists(canonical_target):
                return {"success": False, "error": "Berkas atau folder tidak ditemukan"}

            if not new_name or "/" in new_name or "\\" in new_name:
                return {"success": False, "error": "Nama baru tidak valid"}

            parent_dir = os.path.dirname(canonical_target)
            new_path = os.path.join(parent_dir, new_name)
            canonical_new_path = FileExplorerService.validate_path(new_path)

            if os.path.exists(canonical_new_path):
                return {"success": False, "error": "Berkas atau folder dengan nama tersebut sudah ada"}

            os.rename(canonical_target, canonical_new_path)
            return {
                "success": True,
                "path": canonical_new_path
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    @staticmethod
    def delete_item(target_path: str) -> dict:
        """Menghapus berkas atau folder."""
        try:
            canonical_target = FileExplorerService.validate_path(target_path)
            if not os.path.exists(canonical_target):
                return {"success": False, "error": "Berkas atau folder tidak ditemukan"}

            # Validasi tambahan: cegah penghapusan directory root allowed_roots itu sendiri
            allowed_roots = FileExplorerService.get_allowed_roots()
            if canonical_target in allowed_roots:
                return {"success": False, "error": "Dilarang menghapus direktori root utama"}

            if os.path.isdir(canonical_target):
                shutil.rmtree(canonical_target)
            else:
                os.remove(canonical_target)

            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}
