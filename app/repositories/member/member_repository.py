# app/repositories/member_repository.py

"""Repository untuk entitas Member.

Modul ini mengelola operasi database terkait member/pelanggan warnet
termasuk autentikasi, manajemen saldo waktu, dan refund otomatis.
"""

from app.models import db
from app.models import Member


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
    def get_paginated(search_query=None, page=1, per_page=5, grup_id=None, sort_by="grup_id", order="asc"):
        """Mengambil member dengan filter pencarian, pengurutan, dan pagination."""
        query = Member.query
        if search_query:
            query = query.filter(
                (Member.username.ilike(f"%{search_query}%")) |
                (Member.nama_lengkap.ilike(f"%{search_query}%"))
            )
        
        if grup_id:
            query = query.filter(Member.grup_id == grup_id)
        
        order_dir = db.asc if (order or "asc").lower() == "asc" else db.desc
        
        try:
            if sort_by == "username":
                if (order or "asc").lower() == "asc":
                    query = query.order_by(
                        db.case((Member.username.op('GLOB')('[0-9]*'), 0), else_=1),
                        db.func.cast(Member.username, db.Integer),
                        Member.username.asc()
                    )
                else:
                    query = query.order_by(
                        db.case((Member.username.op('GLOB')('[0-9]*'), 1), else_=0),
                        db.func.cast(Member.username, db.Integer).desc(),
                        Member.username.desc()
                    )
            elif sort_by in ("sisa_waktu", "waktu_tersimpan"):
                query = query.order_by(order_dir(Member.waktu_tersimpan), Member.username.asc())
            elif sort_by in ("status", "aktif"):
                query = query.order_by(order_dir(Member.aktif), Member.username.asc())
            elif sort_by in ("id", "id_member"):
                query = query.order_by(order_dir(Member.id))
            else:
                # Default: sort by grup_id ASC, then username natural sort
                query = query.order_by(
                    order_dir(Member.grup_id),
                    db.case((Member.username.op('GLOB')('[0-9]*'), 0), else_=1),
                    db.func.cast(Member.username, db.Integer),
                    Member.username.asc()
                )
            return query.paginate(page=page, per_page=per_page, error_out=False)
        except Exception:
            db.session.rollback()
            # Standard sorting fallback
            if sort_by == "username":
                fallback_order = order_dir(Member.username)
            elif sort_by in ("sisa_waktu", "waktu_tersimpan"):
                fallback_order = order_dir(Member.waktu_tersimpan)
            elif sort_by in ("status", "aktif"):
                fallback_order = order_dir(Member.aktif)
            else:
                fallback_order = order_dir(Member.grup_id)
            return query.order_by(fallback_order, Member.username.asc()).paginate(page=page, per_page=per_page, error_out=False)

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

