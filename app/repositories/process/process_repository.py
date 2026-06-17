# app/repositories/process_repository.py

"""Repository untuk manajemen data proses PC.

Module ini menangani sinkronisasi daftar proses yang sedang berjalan
di PC client guna keperluan monitoring dan audit keamanan.
"""

from app.models import db
from app.models import PCProcess

class ProcessRepository:
    """Repository untuk entitas PCProcess."""

    @staticmethod
    def sync_processes(pc_id, process_data_list):
        """Singkronisasi daftar proses untuk satu PC.
        
        Menghapus data proses lama untuk PC tersebut dan menggantinya
        dengan data terbaru (snapshot) yang dikirim oleh client.
        
        Args:
            pc_id (int): ID dari PC yang bersangkutan.
            process_data_list (list): Daftar dictionary berisi 'Name' dan 'Title'.
        """
        # 1. Hapus snapshot proses lama
        PCProcess.query.filter_by(pc_id=pc_id).delete()
        
        # 2. Bulk Insert snapshot proses baru
        new_processes = []
        for p in process_data_list:
            new_processes.append(
                PCProcess(
                    pc_id=pc_id,
                    name=p.get("Name", p.get("name", "Unknown")),
                    title=p.get("Title", p.get("title", ""))
                )
            )
        
        if new_processes:
            db.session.bulk_save_objects(new_processes)
        
        # NOTE: Commit akan dilakukan di level Service berbarengan dengan update Hardware
        # agar transaksinya atomik.

    @staticmethod
    def get_by_pc(pc_id):
        """Mengambil semua proses aktif untuk satu PC."""
        return PCProcess.query.filter_by(pc_id=pc_id).order_by(PCProcess.name).all()
