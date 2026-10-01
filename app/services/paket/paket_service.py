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
from app.utils.validators import validate_string_length, validate_integer_range


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
        nama = validate_string_length(data.get("nama", ""), min_len=2, max_len=50, field_name="Nama paket", required=True)
        durasi_menit = validate_integer_range(data.get("durasi_menit", 0), 1, 14400, "Durasi paket (menit)")
        harga = validate_integer_range(data.get("harga", 0), 0, 1_000_000_000, "Harga paket")
        kadaluarsa_hari = validate_integer_range(data.get("kadaluarsa_hari", 30), 1, 3650, "Masa berlaku paket (hari)")
        
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
            durasi_menit=durasi_menit,
            harga=harga,
            kadaluarsa_hari=kadaluarsa_hari,
            grup_id=grup_obj.id,
            aktif=True
        )
        
        db.session.add(paket)
        db.session.commit()
        
        detail_paket = {
            "nama": nama,
            "durasi_menit": paket.durasi_menit,
            "harga": paket.harga,
            "kadaluarsa_hari": paket.kadaluarsa_hari,
            "grup": grup_nama
        }
        write_log("TAMBAH_PAKET", f"Paket {nama} ({grup_nama}) berhasil dibuat", user=operator, detail_json=detail_paket)
        return paket


    # =========================================================================
    # 2. PEMBARUAN & PENGHAPUSAN (UPDATE & DELETE)
    # =========================================================================
    # Fokus: Mengubah data paket dan menghapus paket dengan proteksi integritas sesi.

    @staticmethod
    def update(paket_id, data, operator="system"):
        """Update detail paket (harga, durasi, status aktif, dll)."""
        paket = PaketRepository.get_by_id(paket_id)
        if not paket:
            raise ValueError("Paket tidak ditemukan")
        
        perubahan = {}

        # Update Nama (dengan pengecekan duplikasi selain ID ini sendiri)
        if "nama" in data:
            nama_baru = validate_string_length(data["nama"], min_len=2, max_len=50, field_name="Nama paket", required=True)
            if nama_baru != paket.nama:
                if PaketRepository.find_by_nama_exclude(nama_baru, paket_id):
                    raise ValueError(f"Nama paket '{nama_baru}' sudah dipakai paket lain")
                perubahan["nama"] = {"lama": paket.nama, "baru": nama_baru}
                paket.nama = nama_baru

        # Update Grup
        if "grup" in data:
            grup_obj = GrupRepository.find_by_nama(data["grup"])
            if not grup_obj:
                raise ValueError("Grup yang dipilih tidak valid")
            if paket.grup_id != grup_obj.id:
                perubahan["grup"] = {"lama": paket.grup.nama if paket.grup else "", "baru": grup_obj.nama}
                paket.grup_id = grup_obj.id

        # Update Field Lainnya
        if "durasi_menit" in data:
            val = validate_integer_range(data["durasi_menit"], 1, 14400, "Durasi paket (menit)")
            if val != paket.durasi_menit:
                perubahan["durasi_menit"] = {"lama": paket.durasi_menit, "baru": val}
                paket.durasi_menit = val
        if "harga" in data:
            val = validate_integer_range(data["harga"], 0, 1_000_000_000, "Harga paket")
            if val != paket.harga:
                perubahan["harga"] = {"lama": paket.harga, "baru": val}
                paket.harga = val
        if "kadaluarsa_hari" in data:
            val = validate_integer_range(data["kadaluarsa_hari"], 1, 3650, "Masa berlaku paket (hari)")
            if val != paket.kadaluarsa_hari:
                perubahan["kadaluarsa_hari"] = {"lama": paket.kadaluarsa_hari, "baru": val}
                paket.kadaluarsa_hari = val
        if "aktif" in data:
            val = bool(data["aktif"])
            if val != paket.aktif:
                perubahan["aktif"] = {"lama": paket.aktif, "baru": val}
                paket.aktif = val
        
        db.session.commit()
        write_log("EDIT_PAKET", f"Data paket {paket.nama} diperbarui", user=operator, detail_json=perubahan if perubahan else None)
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
        write_log("HAPUS_PAKET", f"Paket {nama_paket} dihapus permanen", user=operator, detail_json={"nama_paket": nama_paket})
        return True