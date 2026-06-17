# app/repositories/pc_repository.py

"""Repository untuk entitas PC.

Modul ini mengelola operasi database untuk unit komputer/client
termasuk identifikasi berbasis IP dan MAC address.
"""

from app.models import db
from app.models import PC


class PCRepository:
    """Repository class untuk mengelola data PC."""

    # =========================================================================
    # 1. PENGAMBILAN DATA (READ)
    # =========================================================================
    # Fokus: Mengambil daftar PC atau satu unit PC untuk kebutuhan operasional.

    @staticmethod
    def get_all(aktif_only=False, grup_id=None, search_query=None):
        """Mengambil daftar PC dengan sorting grup dan kode, serta filter opsional."""
        query = PC.query
        if aktif_only:
            query = query.filter_by(aktif=True)
        if grup_id:
            query = query.filter_by(grup_id=grup_id)
        if search_query:
            query = query.filter(
                (PC.kode.ilike(f"%{search_query}%")) |
                (PC.nama.ilike(f"%{search_query}%")) |
                (PC.ip_address.ilike(f"%{search_query}%"))
            )
        return query.order_by(PC.grup_id, PC.kode).all()

    @staticmethod
    def get_paginated(aktif_only=False, grup_id=None, page=1, per_page=12, search_query=None):
        """Mengambil daftar PC terpaginasi dengan filter opsional."""
        query = PC.query
        if aktif_only:
            query = query.filter_by(aktif=True)
        if grup_id:
            query = query.filter_by(grup_id=grup_id)
        if search_query:
            query = query.filter(
                (PC.kode.ilike(f"%{search_query}%")) |
                (PC.nama.ilike(f"%{search_query}%")) |
                (PC.ip_address.ilike(f"%{search_query}%"))
            )
        return query.order_by(PC.grup_id, PC.kode).paginate(page=page, per_page=per_page, error_out=False)

    @staticmethod
    def get_by_id(pc_id):
        """Mengambil PC berdasarkan ID (404 jika tidak ditemukan)."""
        return PC.query.get_or_404(pc_id)

    @staticmethod
    def get_by_kode(kode):
        """Mengambil PC aktif berdasarkan kode (Contoh: 'PC01')."""
        return PC.query.filter_by(kode=kode, aktif=True).first()

    @staticmethod
    def get_by_ip(ip_address):
        """Mengambil PC aktif berdasarkan alamat IP."""
        return PC.query.filter_by(ip_address=ip_address, aktif=True).first()

    @staticmethod
    def get_by_ip_and_mac(ip_address, mac_address):
        """Autentikasi kombinasi IP dan MAC untuk client C#."""
        return PC.query.filter_by(
            ip_address=ip_address, 
            mac_address=mac_address, 
            aktif=True
        ).first()

    @staticmethod
    def get_all_admin_mode():
        """Mengambil daftar PC yang sedang dalam mode Admin (Bypass)."""
        return PC.query.filter_by(is_admin_mode=True).all()


    # =========================================================================
    # 2. PENCARIAN & VALIDASI (SEARCH)
    # =========================================================================
    # Fokus: Mencari record tanpa filter 'aktif' guna validasi duplikasi.

    @staticmethod
    def find_by_kode(kode):
        """Mencari kode tanpa filter status (untuk validasi duplikat)."""
        return PC.query.filter_by(kode=kode).first()

    @staticmethod
    def find_by_ip(ip):
        """Mencari IP tanpa filter status."""
        return PC.query.filter_by(ip_address=ip).first()

    @staticmethod
    def find_by_mac(mac):
        """Mencari MAC tanpa filter status."""
        return PC.query.filter_by(mac_address=mac).first()

    @staticmethod
    def find_ip_exclude(ip, exclude_id):
        """Validasi IP unik saat update (exclude ID tertentu)."""
        return PC.query.filter(PC.ip_address == ip, PC.id != exclude_id).first()

    @staticmethod
    def find_mac_exclude(mac, exclude_id):
        """Validasi MAC unik saat update (exclude ID tertentu)."""
        return PC.query.filter(PC.mac_address == mac, PC.id != exclude_id).first()


    # =========================================================================
    # 3. PENYIMPANAN & PENGHAPUSAN (WRITE)
    # =========================================================================
    # Fokus: Operasi modifikasi data ke database.

    @staticmethod
    def save(pc):
        """Menambahkan atau update unit PC (Tanpa Commit)."""
        db.session.add(pc)

    @staticmethod
    def save_batch(pc_list):
        """Bulk insert/update (Tanpa Commit)."""
        db.session.add_all(pc_list)

    @staticmethod
    def delete(pc):
        """Menghapus unit PC (Tanpa Commit)."""
        db.session.delete(pc)