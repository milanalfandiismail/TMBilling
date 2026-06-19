# app/services/paket_service.py

"""Service untuk manajemen paket harga.

Modul ini menangani CRUD paket dengan validasi grup
dan proteksi penghapusan jika sedang digunakan.
"""

from app.models import db
from app.models import Paket
from app.repositories import PaketRepository
from app.repositories import SesiRepository
from app.repositories import GrupRepository
from app.utils.logger import write_log
from app.models import db


class PaketService:
    """Service untuk business logic Paket."""

    # =========================================================================
    # 1. PENGAMBILAN & PEMBUATAN DATA (READ & CREATE)
    # =========================================================================
    # Fokus: Mengambil daftar paket untuk kasir dan validasi pembuatan paket baru.

    @staticmethod
    def get_all(aktif_only=False, grup_id=None, search_query=None):
        """Ambil daftar paket dengan filter grup, search, dan status aktif."""
        grup_id_parsed = None
        if grup_id:
            if isinstance(grup_id, int):
                grup_id_parsed = grup_id
            elif str(grup_id).isdigit():
                grup_id_parsed = int(grup_id)
            else:
                grup_obj = GrupRepository.find_by_nama(grup_id)
                if grup_obj:
                    grup_id_parsed = grup_obj.id
        return PaketRepository.get_all(aktif_only, grup_id_parsed, search_query)

    @staticmethod
    def get_paginated(aktif_only=False, grup_id=None, page=1, per_page=10, search_query=None):
        """Ambil daftar paket terpaginasi dengan filter."""
        grup_id_parsed = None
        if grup_id:
            if isinstance(grup_id, int):
                grup_id_parsed = grup_id
            elif str(grup_id).isdigit():
                grup_id_parsed = int(grup_id)
            else:
                grup_obj = GrupRepository.find_by_nama(grup_id)
                if grup_obj:
                    grup_id_parsed = grup_obj.id
        return PaketRepository.get_paginated(aktif_only, grup_id_parsed, page, per_page, search_query)

    @staticmethod
    def get_by_id(paket_id):
        """Ambil satu detail paket berdasarkan ID."""
        return PaketRepository.get_by_id(paket_id)

    @staticmethod
    def create(data, operator="system"):
        """Buat paket baru dengan validasi nama unik dan grup yang tersedia."""
        nama = data.get("nama", "").strip()
        if not nama:
            raise ValueError("Nama paket wajib diisi")
        
        # Validasi: Cek duplikasi nama
        if PaketRepository.find_by_nama(nama):
            raise ValueError(f"Paket dengan nama '{nama}' sudah ada")

        # Validasi: Cek keberadaan grup
        grup_nama = data.get("grup", "reguler")
        grup_obj = GrupRepository.find_by_nama(grup_nama)
        if not grup_obj:
            raise ValueError(f"Grup '{grup_nama}' tidak ditemukan. Buat grupnya dulu bang.")

        paket = Paket(
            nama=nama,
            durasi_menit=int(data.get("durasi_menit", 0)),
            harga=int(data.get("harga", 0)),
            kadaluarsa_hari=int(data.get("kadaluarsa_hari", 30)),
            grup_id=grup_obj.id,
            aktif=True
        )
        
        db.session.add(paket)
        db.session.commit()
        write_log("TAMBAH_PAKET", f"Paket {nama} ({grup_nama}) berhasil dibuat", user=operator)
        return paket


    # =========================================================================
    # 2. PEMBARUAN & PENGHAPUSAN (UPDATE & DELETE)
    # =========================================================================
    # Fokus: Mengubah data paket dan menghapus paket dengan proteksi integritas sesi.

    @staticmethod
    def update(paket_id, data, operator="system"):
        """Update detail paket (harga, durasi, status aktif, dll)."""
        paket = PaketRepository.get_by_id(paket_id)

        # Update Nama (dengan pengecekan duplikasi selain ID ini sendiri)
        if "nama" in data:
            nama_baru = data["nama"].strip()
            if nama_baru != paket.nama:
                if PaketRepository.find_by_nama_exclude(nama_baru, paket_id):
                    raise ValueError(f"Nama paket '{nama_baru}' sudah dipakai paket lain")
                paket.nama = nama_baru

        # Update Grup
        if "grup" in data:
            grup_obj = GrupRepository.find_by_nama(data["grup"])
            if not grup_obj:
                raise ValueError("Grup yang dipilih tidak valid")
            paket.grup_id = grup_obj.id

        # Update Field Lainnya
        if "durasi_menit" in data:
            paket.durasi_menit = int(data["durasi_menit"])
        if "harga" in data:
            paket.harga = int(data["harga"])
        if "kadaluarsa_hari" in data:
            paket.kadaluarsa_hari = int(data["kadaluarsa_hari"])
        if "aktif" in data:
            paket.aktif = bool(data["aktif"])
        
        db.session.commit()
        write_log("EDIT_PAKET", f"Data paket {paket.nama} diperbarui", user=operator)
        return paket

    @staticmethod
    def delete(paket_id, operator="system"):
        """Hapus paket jika tidak sedang digunakan oleh sesi aktif manapun."""
        paket = PaketRepository.get_by_id(paket_id)

        # PROTEKSI: Jangan hapus paket kalau ada user yang lagi main pake paket ini
        if SesiRepository.get_aktif_by_paket(paket.id):
            raise ValueError("Paket ini sedang dipakai member/guest yang sedang main!")

        nama_paket = paket.nama
        db.session.delete(paket)
        db.session.commit()
        write_log("HAPUS_PAKET", f"Paket {nama_paket} dihapus permanen", user=operator)
        return True