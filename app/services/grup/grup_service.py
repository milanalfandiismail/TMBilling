# app/services/grup_service.py

"""Service untuk manajemen grup/kategori.

Modul ini menangani business logic CRUD grup dengan proteksi
penghapusan (tidak bisa hapus grup yang masih punya relasi).
"""

from app.models import db
from app.models import Grup
from app.repositories import GrupRepository
from app.utils.logger import write_log


class GrupService:
    """Service untuk business logic Grup."""

    # =========================================================================
    # 1. MANAJEMEN DATA (READ & CREATE)
    # =========================================================================
    # Fokus: Mengambil daftar grup dan validasi pembuatan grup baru agar tidak duplikat.

    @staticmethod
    def get_all():
        """Ambil semua grup melalui repository."""
        return GrupRepository.get_all()

    @staticmethod
    def create(data, operator="system"):
        """Buat grup baru dengan validasi keunikan nama."""
        nama = data.get("nama", "").strip().lower()
        
        # Validasi: Cek apakah nama sudah terpakai
        if GrupRepository.find_by_nama(nama):
            raise ValueError("Grup sudah ada")
        
        grup = Grup(
            nama=nama, 
            keterangan=data.get("keterangan"),
            warna=data.get("warna")
        )
        db.session.add(grup)
        db.session.commit()
        
        write_log("TAMBAH_GRUP", f"Grup baru: {nama}", user=operator)
        return grup


    # =========================================================================
    # 2. PENGHAPUSAN DENGAN PROTEKSI (SAFE DELETE)
    # =========================================================================
    # Fokus: Menjamin integritas data dengan menolak penghapusan grup yang masih terikat.

    @staticmethod
    def delete(grup_id, operator="system"):
        """Hapus grup dengan validasi relasi (Member, PC, dan Paket)."""
        grup = GrupRepository.get_by_id(grup_id)
        if not grup:
            raise ValueError("Grup tidak ditemukan")
        
        # --- DATA INTEGRITY CHECK ---
        # Proteksi: Jangan biarkan grup dihapus jika masih ada 'anak'-nya
        if len(grup.member_list) > 0:
            raise ValueError(f"Grup {grup.nama} tidak bisa dihapus karena masih ada Member")
            
        if len(grup.pc_list) > 0:
            raise ValueError(f"Grup {grup.nama} masih digunakan oleh beberapa PC")
            
        if len(grup.paket_list) > 0:
            raise ValueError(f"Grup {grup.nama} masih memiliki paket")
        
        # Eksekusi hapus jika lolos semua syarat
        nama_lama = grup.nama
        db.session.delete(grup)
        db.session.commit()
        
        write_log("HAPUS_GRUP", f"Grup {nama_lama} dihapus", user=operator)
        return True

    @staticmethod
    def update(grup_id, data, operator="system"):
        """Update data grup dengan validasi keunikan nama."""
        grup = GrupRepository.get_by_id(grup_id)
        if not grup:
            raise ValueError("Grup tidak ditemukan")

        nama = data.get("nama", "").strip().lower()
        if not nama:
            raise ValueError("Nama grup tidak boleh kosong")

        if nama != grup.nama.lower():
            if GrupRepository.find_by_nama(nama):
                raise ValueError("Nama grup sudah digunakan oleh grup lain")

        grup.nama = nama
        grup.keterangan = data.get("keterangan")
        grup.warna = data.get("warna")
        db.session.commit()

        write_log("EDIT_GRUP", f"Grup {nama} diupdate", user=operator)
        return grup