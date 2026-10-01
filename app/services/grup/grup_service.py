# app/services/grup_service.py

"""Service untuk manajemen grup/kategori.

Modul ini menangani business logic CRUD grup dengan proteksi
penghapusan (tidak bisa hapus grup yang masih punya relasi).
"""

import re
from app.models import db
from app.models import Grup
from app.repositories import GrupRepository
from app.utils.logger import write_log
from app.utils.validators import validate_hex_color, validate_string_length


class GrupService:
    """Service untuk business logic Grup."""

    # =========================================================================
    # 1. MANAJEMEN DATA (READ & CREATE)
    # =========================================================================
    # Fokus: Mengambil daftar grup dan validasi pembuatan grup baru agar tidak duplikat.

    @staticmethod
    def _validate_nama_grup(nama: str) -> str:
        """Validasi format dan panjang nama grup."""
        cleaned = validate_string_length(nama, min_len=2, max_len=30, field_name="Nama grup", required=True).lower()
        if not re.match(r'^[a-z0-9 _-]+$', cleaned):
            raise ValueError("Nama grup hanya boleh berisi huruf, angka, spasi, garis bawah (_), atau minus (-)")
        return cleaned

    @staticmethod
    def get_all():
        """Ambil semua grup melalui repository."""
        return GrupRepository.get_all()

    @staticmethod
    def create(data, operator="system"):
        """Buat grup baru dengan validasi keunikan nama."""
        nama = GrupService._validate_nama_grup(data.get("nama", ""))
        warna = validate_hex_color(data.get("warna"), default="#888888")
        keterangan = validate_string_length(data.get("keterangan", ""), min_len=0, max_len=200, field_name="Keterangan", required=False)
        
        # Validasi: Cek apakah nama sudah terpakai
        if GrupRepository.find_by_nama(nama):
            raise ValueError("Grup sudah ada")
        
        grup = Grup(
            nama=nama, 
            keterangan=keterangan,
            warna=warna
        )
        db.session.add(grup)
        db.session.commit()
        
        detail_grup = {
            "nama": nama,
            "keterangan": grup.keterangan,
            "warna": grup.warna
        }
        write_log("TAMBAH_GRUP", f"Grup baru: {nama}", user=operator, detail_json=detail_grup)
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
        
        write_log("HAPUS_GRUP", f"Grup {nama_lama} dihapus", user=operator, detail_json={"nama_grup": nama_lama})
        return True

    @staticmethod
    def update(grup_id, data, operator="system"):
        """Update data grup dengan validasi keunikan nama."""
        grup = GrupRepository.get_by_id(grup_id)
        if not grup:
            raise ValueError("Grup tidak ditemukan")

        if "nama" in data:
            nama = GrupService._validate_nama_grup(data["nama"])
            if nama != grup.nama.lower():
                if GrupRepository.find_by_nama(nama):
                    raise ValueError("Nama grup sudah digunakan oleh grup lain")
            grup.nama = nama

        if "keterangan" in data:
            grup.keterangan = validate_string_length(data.get("keterangan", ""), min_len=0, max_len=200, field_name="Keterangan", required=False)

        if "warna" in data:
            grup.warna = validate_hex_color(data.get("warna"), default="#888888")

        db.session.commit()

        detail_grup = {
            "nama": grup.nama,
            "keterangan": grup.keterangan,
            "warna": grup.warna
        }
        write_log("EDIT_GRUP", f"Grup {grup.nama} diupdate", user=operator, detail_json=detail_grup)
        return grup