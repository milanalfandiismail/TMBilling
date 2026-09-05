# app/services/notes/note_service.py
import os
import re
import time
import json
from datetime import datetime
from flask import current_app

class NoteService:
    @classmethod
    def get_notes_dir(cls) -> str:
        """Mengambil direktori absolut untuk penyimpanan catatan .txt di folder instance."""
        try:
            if current_app:
                base_dir = os.path.join(current_app.instance_path, 'notes')
            else:
                base_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 'instance', 'notes')
        except Exception:
            base_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 'instance', 'notes')
        
        abs_path = os.path.realpath(base_dir)
        os.makedirs(abs_path, exist_ok=True)
        return abs_path

    @classmethod
    def sanitize_filename(cls, name: str) -> str:
        """Sanitasi nama file catatan agar aman dari karakter ilegal dan traversal."""
        if not name:
            name = f"catatan_{int(time.time())}"
        
        # Bersihkan path separator dan karakter berbahaya
        clean_name = os.path.basename(name.strip())
        clean_name = re.sub(r'[\\/*?:"<>|]', '_', clean_name).strip()
        clean_name = clean_name.replace('..', '_')

        if not clean_name or clean_name == '.txt':
            clean_name = f"catatan_{int(time.time())}"

        if not clean_name.lower().endswith('.txt'):
            clean_name += '.txt'

        return clean_name

    @classmethod
    def validate_path(cls, filename: str) -> str:
        """Validasi path untuk memastikan berkas berada di dalam folder notes (mencegah directory traversal)."""
        if not filename or ".." in filename or filename.startswith("/") or filename.startswith("\\"):
            raise ValueError("Akses tidak sah: Nama berkas tidak valid atau mencoba traversal!")
        clean_filename = cls.sanitize_filename(filename)
        notes_dir = cls.get_notes_dir()
        target_path = os.path.realpath(os.path.join(notes_dir, clean_filename))

        # Keamanan: Path target wajib berada di dalam notes_dir
        if not target_path.startswith(notes_dir + os.sep) and target_path != notes_dir:
            raise ValueError("Akses tidak sah: Path berada di luar direktori catatan!")

        return target_path

    @classmethod
    def _get_pinned_file_path(cls) -> str:
        """Mengambil path berkas metadata .pinned.json di folder notes."""
        return os.path.join(cls.get_notes_dir(), '.pinned.json')

    @classmethod
    def _get_pinned_set(cls) -> set[str]:
        """Membaca daftar nama berkas yang disematkan (pinned)."""
        pinned_path = cls._get_pinned_file_path()
        if not os.path.exists(pinned_path):
            return set()
        try:
            with open(pinned_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, list):
                    return set(data)
                elif isinstance(data, dict) and 'pinned' in data:
                    return set(data['pinned'])
        except Exception:
            pass
        return set()

    @classmethod
    def _save_pinned_set(cls, pinned_set: set[str]):
        """Menyimpan daftar nama berkas yang disematkan ke .pinned.json."""
        pinned_path = cls._get_pinned_file_path()
        try:
            with open(pinned_path, 'w', encoding='utf-8') as f:
                json.dump(sorted(list(pinned_set)), f, indent=2)
        except Exception:
            pass

    @classmethod
    def toggle_pin(cls, filename: str) -> dict:
        """Menyematkan atau melepas sematan (pin/unpin) pada berkas catatan."""
        file_path = cls.validate_path(filename)
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Catatan '{filename}' tidak ditemukan")

        clean_name = os.path.basename(file_path)
        pinned = cls._get_pinned_set()
        if clean_name in pinned:
            pinned.remove(clean_name)
            is_pinned = False
        else:
            pinned.add(clean_name)
            is_pinned = True

        cls._save_pinned_set(pinned)
        return {
            'filename': clean_name,
            'is_pinned': is_pinned
        }

    @classmethod
    def duplicate_note(cls, filename: str) -> dict:
        """Membuat salinan dari catatan yang sudah ada."""
        source_note = cls.get_note(filename)
        source_title = source_note['title']
        source_content = source_note['content']

        copy_title = f"{source_title} (Salinan)"
        return cls.create_note(copy_title, source_content)

    @classmethod
    def list_notes(cls, query: str = None) -> list[dict]:
        """Mengambil daftar seluruh berkas catatan .txt dengan dukungan pencarian & prioritas pin."""
        notes_dir = cls.get_notes_dir()
        notes = []

        if not os.path.exists(notes_dir):
            return []

        pinned_set = cls._get_pinned_set()
        q = query.lower().strip() if query else None

        for entry in os.scandir(notes_dir):
            if entry.is_file() and entry.name.lower().endswith('.txt'):
                try:
                    stat = entry.stat()
                    # Baca isi catatan untuk preview dan pencarian penuh
                    full_content = ""
                    try:
                        with open(entry.path, 'r', encoding='utf-8', errors='replace') as f:
                            full_content = f.read()
                    except Exception:
                        pass

                    preview = full_content[:160].strip()
                    title = entry.name[:-4] if entry.name.lower().endswith('.txt') else entry.name

                    # Jika ada query pencarian, cek apakah query ada di judul atau di seluruh isi konten
                    if q and (q not in title.lower() and q not in full_content.lower()):
                        continue

                    updated_dt = datetime.fromtimestamp(stat.st_mtime)
                    is_pinned = entry.name in pinned_set

                    notes.append({
                        'filename': entry.name,
                        'title': title,
                        'size': stat.st_size,
                        'updated_at': updated_dt.strftime('%Y-%m-%d %H:%M:%S'),
                        'updated_timestamp': stat.st_mtime,
                        'preview': preview,
                        'is_pinned': is_pinned
                    })
                except Exception:
                    continue

        # Urutkan: Pinned selalu di paling atas (is_pinned: True), lalu modifikasi terbaru
        notes.sort(key=lambda x: (not x.get('is_pinned', False), -x.get('updated_timestamp', 0)))
        return notes

    @classmethod
    def get_note(cls, filename: str) -> dict:
        """Membaca isi berkas catatan .txt."""
        file_path = cls.validate_path(filename)
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Catatan '{filename}' tidak ditemukan")

        stat = os.stat(file_path)
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()

        real_name = os.path.basename(file_path)
        title = real_name[:-4] if real_name.lower().endswith('.txt') else real_name
        updated_dt = datetime.fromtimestamp(stat.st_mtime)
        is_pinned = real_name in cls._get_pinned_set()

        return {
            'filename': real_name,
            'title': title,
            'content': content,
            'size': stat.st_size,
            'updated_at': updated_dt.strftime('%Y-%m-%d %H:%M:%S'),
            'updated_timestamp': stat.st_mtime,
            'is_pinned': is_pinned
        }

    @classmethod
    def create_note(cls, title: str, content: str = "") -> dict:
        """Membuat berkas catatan .txt baru."""
        notes_dir = cls.get_notes_dir()
        base_name = cls.sanitize_filename(title)
        stem = base_name[:-4] if base_name.lower().endswith('.txt') else base_name
        
        target_name = base_name
        target_path = os.path.join(notes_dir, target_name)
        counter = 1

        # Hindari overwrite file dengan nama yang sama jika baru membuat
        while os.path.exists(target_path):
            target_name = f"{stem}_{counter}.txt"
            target_path = os.path.join(notes_dir, target_name)
            counter += 1

        with open(target_path, 'w', encoding='utf-8') as f:
            f.write(content)

        return cls.get_note(target_name)

    @classmethod
    def save_note(cls, filename: str, content: str, new_title: str = None) -> dict:
        """Menyimpan pembaruan isi catatan dan rename judul berkas jika diminta."""
        file_path = cls.validate_path(filename)
        if not os.path.exists(file_path):
            # Jika belum ada, buat berkas baru
            return cls.create_note(new_title or filename, content)

        target_path = file_path
        target_filename = os.path.basename(file_path)

        # Proses rename jika judul diubah
        if new_title:
            desired_name = cls.sanitize_filename(new_title)
            if desired_name != target_filename:
                notes_dir = cls.get_notes_dir()
                candidate_path = os.path.join(notes_dir, desired_name)
                # Jika nama baru belum ada, ganti nama
                if not os.path.exists(candidate_path):
                    os.rename(file_path, candidate_path)
                    target_path = candidate_path

                    # Update status pinned ke nama baru jika sebelumnya di-pin
                    pinned = cls._get_pinned_set()
                    if target_filename in pinned:
                        pinned.remove(target_filename)
                        pinned.add(desired_name)
                        cls._save_pinned_set(pinned)

                    target_filename = desired_name
                else:
                    # Nama target sudah dipakai file lain, pertahankan target path
                    pass

        with open(target_path, 'w', encoding='utf-8') as f:
            f.write(content)

        return cls.get_note(target_filename)

    @classmethod
    def delete_note(cls, filename: str) -> bool:
        """Menghapus berkas catatan .txt dan membersihkan status pin."""
        file_path = cls.validate_path(filename)
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Catatan '{filename}' tidak ditemukan")

        clean_name = os.path.basename(file_path)
        os.remove(file_path)

        # Bersihkan dari daftar pinned jika ada
        pinned = cls._get_pinned_set()
        if clean_name in pinned:
            pinned.remove(clean_name)
            cls._save_pinned_set(pinned)

        return True
