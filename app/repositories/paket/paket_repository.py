# app/repositories/paket_repository.py

"""Repository untuk entitas Paket.

Modul ini mengelola operasi database untuk paket harga dan durasi
yang tersedia dalam sistem billing.
"""

from app.models import db
from app.models import Paket


class PaketRepository:
    """Repository class untuk mengelola data Paket."""

    # =========================================================================
    # 1. PENGAMBILAN DATA (READ)
    # =========================================================================
    # Fokus: Mengambil daftar paket untuk ditampilkan di menu kasir atau pilihan paket.

    @staticmethod
    def get_all(aktif_only=False, grup_id=None, search_query=None):
        """Mengambil daftar paket diurutkan berdasarkan harga (Ascending) dengan filter opsional."""
        query = Paket.query
        if aktif_only:
            query = query.filter_by(aktif=True)
        if grup_id:
            query = query.filter_by(grup_id=grup_id)
        if search_query:
            query = query.filter(Paket.nama.ilike(f"%{search_query}%"))
        return query.order_by(Paket.harga).all()

    @staticmethod
    def get_paginated(aktif_only=False, grup_id=None, page=1, per_page=10, search_query=None):
        """Mengambil daftar paket terpaginasi diurutkan berdasarkan harga dengan filter opsional."""
        query = Paket.query
        if aktif_only:
            query = query.filter_by(aktif=True)
        if grup_id:
            query = query.filter_by(grup_id=grup_id)
        if search_query:
            query = query.filter(Paket.nama.ilike(f"%{search_query}%"))
        return query.order_by(Paket.harga).paginate(page=page, per_page=per_page, error_out=False)

    @staticmethod
    def get_by_id(paket_id):
        """Mengambil satu paket berdasarkan ID (404 jika tidak ditemukan)."""
        return Paket.query.get_or_404(paket_id)


    # =========================================================================
    # 2. PENCARIAN & VALIDASI (SEARCH)
    # =========================================================================
    # Fokus: Mencari data paket guna validasi saat pembuatan atau edit paket.

    @staticmethod
    def find_by_nama(nama):
        """Mencari paket berdasarkan nama tanpa filter status."""
        return Paket.query.filter_by(nama=nama).first()

    @staticmethod
    def find_by_nama_exclude(nama, exclude_id):
        """Validasi nama paket unik saat update (exclude ID tertentu)."""
        return Paket.query.filter(Paket.nama == nama, Paket.id != exclude_id).first()


    # =========================================================================
    # 3. OPERASI PENYIMPANAN & PENGHAPUSAN (WRITE)
    # =========================================================================
    # Fokus: Sinkronisasi data paket ke database.

    @staticmethod
    def save(paket):
        """Menambahkan paket baru atau update (Tanpa Commit)."""
        db.session.add(paket)

    @staticmethod
    def delete(paket):
        """Menghapus paket (Tanpa Commit)."""
        db.session.delete(paket)

