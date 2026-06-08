# app/repositories/member_repository.py

"""Repository untuk entitas Member.

Modul ini mengelola operasi database terkait member/pelanggan warnet
termasuk autentikasi, manajemen saldo waktu, dan refund otomatis.
"""

from app.models.base import db
from app.models.member import Member


class MemberRepository:
    """Repository class untuk mengelola data Member."""

    # =========================================================================
    # 1. PENGAMBILAN DATA (READ / FETCHING)
    # =========================================================================
    # Fokus: Mengambil data member untuk keperluan UI dashboard atau login.

    @staticmethod
    def get_all():
        """Mengambil semua member termasuk yang nonaktif (Sorting by Username)."""
        return Member.query.order_by(Member.username).all()

    @staticmethod
    def get_paginated(search_query=None, page=1, per_page=10, grup_id=None):
        """Mengambil member dengan filter pencarian dan pagination."""
        query = Member.query
        if search_query:
            query = query.filter(
                (Member.username.ilike(f"%{search_query}%")) |
                (Member.nama_lengkap.ilike(f"%{search_query}%"))
            )
        
        if grup_id:
            query = query.filter(Member.grup_id == grup_id)
        
        # Natural Sorting Logic (Numerics first, then Alphabetical)
        try:
            # We try SQLite-specific natural sorting first
            return query.order_by(
                db.case(
                    (Member.username.op('GLOB')('[0-9]*'), 0),
                    else_=1
                ),
                db.func.cast(Member.username, db.Integer),
                Member.username
            ).paginate(page=page, per_page=per_page, error_out=False)
        except Exception:
            db.session.rollback()
            # Standard alphabetical sorting fallback for strict database engines (PostgreSQL, MySQL, etc.)
            return query.order_by(Member.username.asc()).paginate(page=page, per_page=per_page, error_out=False)

    @staticmethod
    def get_all_aktif():
        """Mengambil semua member dengan status aktif saja."""
        return Member.query.filter_by(aktif=True).all()

    @staticmethod
    def get_by_id(member_id):
        """Mengambil member berdasarkan ID (404 jika tidak ditemukan)."""
        return Member.query.get_or_404(member_id)

    @staticmethod
    def get_by_username(username):
        """Mengambil member aktif berdasarkan username (untuk login)."""
        return Member.query.filter_by(username=username, aktif=True).first()


    # =========================================================================
    # 2. PENCARIAN & VALIDASI (SEARCH)
    # =========================================================================
    # Fokus: Validasi data saat registrasi atau pengecekan duplikasi.

    @staticmethod
    def find_by_username(username):
        """Mencari username tanpa filter status (untuk validasi registrasi)."""
        return Member.query.filter_by(username=username).first()


    # =========================================================================
    # 3. MANAJEMEN SALDO WAKTU (BALANCE MANAGEMENT)
    # =========================================================================
    # Fokus: Logika khusus untuk menambah atau mengubah sisa waktu bermain.

    @staticmethod
    def tambah_saldo_menit(member_id, tambahan_menit):
        """Menambahkan saldo waktu ke akun member (Refund/Recovery)."""
        member = Member.query.get(member_id)
        if member:
            member.waktu_tersimpan += tambahan_menit
            return True
        return False

    @staticmethod
    def update_waktu(member, waktu_baru):
        """Update total waktu tersimpan member (Tanpa Commit)."""
        member.waktu_tersimpan = waktu_baru


    # =========================================================================
    # 4. OPERASI PENYIMPANAN & PENGHAPUSAN (WRITE)
    # =========================================================================
    # Fokus: Sinkronisasi objek member ke database.

    @staticmethod
    def save(member):
        """Menambahkan member baru atau update (Tanpa Commit)."""
        db.session.add(member)

    @staticmethod
    def delete(member):
        """Menghapus member (Tanpa Commit)."""
        db.session.delete(member)

