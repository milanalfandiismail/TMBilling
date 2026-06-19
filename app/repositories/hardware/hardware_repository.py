# app/repositories/hardware_repository.py

"""Repository untuk entitas HardwareMonitor.

Module ini mengelola operasi database untuk data hardware
monitoring yang dikirim oleh C# agent di setiap PC client.
"""

from app.models import db
from app.models import HardwareMonitor

class HardwareRepository:
    """Repository untuk entitas HardwareMonitor."""

    @staticmethod
    def get_by_pc_id(pc_id):
        """Mengambil data hardware monitor berdasarkan PC ID."""
        return HardwareMonitor.query.filter_by(pc_id=pc_id).first()

    @staticmethod
    def get_all_with_pc():
        """Mengambil semua data hardware monitor beserta relasi PC."""
        return HardwareMonitor.query.join(HardwareMonitor.pc).all()

    @staticmethod
    def save(hardware):
        """Menambahkan atau update data hardware (Tanpa Commit)."""
        db.session.add(hardware)

    @staticmethod
    def get_by_id(hardware_id):
        """Mengambil data hardware monitor berdasarkan ID."""
        return HardwareMonitor.query.get(hardware_id)

    @staticmethod
    def delete(hardware):
        """Menghapus data hardware monitor dari database (Tanpa Commit)."""
        db.session.delete(hardware)

    @staticmethod
    def rollback():
        """Rollback database session jika terjadi error."""
        db.session.rollback()
