# app/repositories/process_repository.py

"""Repository untuk manajemen data proses PC.

Module ini menangani sinkronisasi daftar proses yang sedang berjalan
di PC client guna keperluan monitoring dan audit keamanan.
Menggunakan In-Memory Store untuk menghindari I/O disk SQLite per detik.
"""

from app.models import db, PCProcess
from app.models.base.base import now_local
from app.utils.timezone_utils import format_display


class InMemProcess:
    """Wrapper kompatibel untuk data proses in-memory agar to_dict() dan attribute match."""
    def __init__(self, name, title, last_update=None):
        self.name = name
        self.title = title
        self.last_update = last_update or now_local()

    def to_dict(self):
        return {
            "name": self.name,
            "title": self.title,
            "last_update": format_display(self.last_update, fmt="%H:%M") if self.last_update else None
        }


class ProcessRepository:
    """Repository untuk entitas PCProcess (In-Memory Powered)."""

    @staticmethod
    def sync_processes(pc_id, process_data_list):
        """Sinkronisasi daftar proses untuk satu PC ke In-Memory RAM Store.
        
        Zero disk I/O: Menghindari DELETE dan bulk INSERT ke database SQLite setiap detik.
        
        Args:
            pc_id (int): ID dari PC yang bersangkutan.
            process_data_list (list): Daftar dictionary berisi 'Name' dan 'Title'.
        """
        from app.services.cache.telemetry_store import ProcessMemoryStore
        ProcessMemoryStore.set(pc_id, process_data_list)

    @staticmethod
    def get_by_pc(pc_id):
        """Mengambil semua proses aktif untuk satu PC dari RAM (dengan fallback DB)."""
        from app.services.cache.telemetry_store import ProcessMemoryStore
        cached = ProcessMemoryStore.get(pc_id)
        if cached:
            return [InMemProcess(p["name"], p["title"]) for p in cached]
        
        # Fallback ke DB jika cache RAM belum terisi
        return PCProcess.query.filter_by(pc_id=pc_id).order_by(PCProcess.name).all()
