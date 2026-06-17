# app/repositories/transaksi_repository.py

"""Repository untuk entitas Transaksi.

Modul ini mengelola operasi database untuk pencatatan keuangan
termasuk kalkulasi pendapatan dan histori pembelian.
"""

from app.models import db
from app.models import Transaksi
from app.models import Sesi
from sqlalchemy import func


class TransaksiRepository:
    """Repository class untuk mengelola data Transaksi."""

    # =========================================================================
    # 1. PENGAMBILAN DATA (READ / FETCHING)
    # =========================================================================

    @staticmethod
    def get_by_id(transaksi_id):
        """Ambil transaksi berdasarkan ID."""
        return Transaksi.query.get(transaksi_id)

    @staticmethod
    def get_by_no_nota(no_nota):
        """Ambil transaksi berdasarkan nomor nota."""
        return Transaksi.query.filter_by(no_nota=no_nota).first()

    @staticmethod
    def get_by_sesi_id(sesi_id):
        """Ambil transaksi berdasarkan ID sesi (terutama untuk fallback format lama)."""
        return Transaksi.query.filter_by(sesi_id=sesi_id).order_by(Transaksi.dibuat_pada.asc()).first()

    @staticmethod
    def get_last_paket_member(member_id):
        """Ambil pembelian paket terakhir member."""
        return Transaksi.query.filter_by(
            member_id=member_id,
            jenis="beli_paket_member"
        ).order_by(Transaksi.dibuat_pada.desc()).first()

    @staticmethod
    def get_riwayat_paket_member(member_id):
        """Ambil riwayat paket member yang belum direfund."""
        return Transaksi.query.filter(
            Transaksi.member_id == member_id,
            Transaksi.jenis.in_(["beli_paket_member", "tambah_waktu_sesi"]),
            Transaksi.is_refunded == False
        ).order_by(Transaksi.dibuat_pada.desc()).all()

    @staticmethod
    def get_all_by_tanggal_with_nota(tanggal, kasir_id=None):
        """Pusat query transaksi harian yang ada nomor notanya."""
        query = Transaksi.query.filter(
            db.func.date(Transaksi.dibuat_pada) == tanggal,
            Transaksi.no_nota != None
        )
        if kasir_id:
            query = query.filter(Transaksi.user_id == kasir_id)
        return query.order_by(Transaksi.dibuat_pada.desc()).all()

    @staticmethod
    def get_history_nota_by_date(tanggal, kasir_id=None):
        """Alias untuk get_all_by_tanggal_with_nota"""
        return TransaksiRepository.get_all_by_tanggal_with_nota(tanggal, kasir_id)

    @staticmethod
    def get_history_nota_paginated(tanggal, page=1, per_page=10, kasir_id=None):
        """Ambil histori nota dengan pagination."""
        query = Transaksi.query.filter(
            func.date(Transaksi.dibuat_pada) == tanggal,
            Transaksi.no_nota != None
        )
        if kasir_id:
            query = query.filter(Transaksi.user_id == kasir_id)
        
        return query.order_by(Transaksi.dibuat_pada.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )


    # =========================================================================
    # 2. OPERASI SIMPAN & UPDATE (WRITE / PERSISTENCE)
    # =========================================================================

    @staticmethod
    def save(transaksi):
        """Menambahkan transaksi ke database (Tanpa Commit)."""
        db.session.add(transaksi)

    # Update dipindah ke Service (Explicit commit)

    @staticmethod
    def update_refund_status(transaksi):
        """Menandai transaksi sebagai sudah direfund (Tanpa Commit)."""
        transaksi.is_refunded = True


    # =========================================================================
    # 3. STATISTIK & LAPORAN (CALCULATION)
    # =========================================================================

    @staticmethod
    def get_total_pemasukan_hari_ini(tanggal, kasir_id=None):
        """Total pemasukan (jumlah > 0, tanpa refund)."""
        query = db.session.query(func.sum(Transaksi.jumlah)).filter(
            func.date(Transaksi.dibuat_pada) == tanggal,
            Transaksi.jumlah > 0
        )
        if kasir_id:
            query = query.filter(Transaksi.user_id == kasir_id)
        return query.scalar() or 0

    @staticmethod
    def get_total_refund_hari_ini(tanggal, kasir_id=None):
        """Total refund (nilai positif)."""
        query = db.session.query(func.sum(Transaksi.jumlah)).filter(
            func.date(Transaksi.dibuat_pada) == tanggal,
            Transaksi.jenis == "refund_paket"
        )
        if kasir_id:
            query = query.filter(Transaksi.user_id == kasir_id)
        refund = query.scalar() or 0
        return abs(refund)

    @staticmethod
    def get_total_pendapatan_hari_ini(tanggal, kasir_id=None):
        """Total pendapatan bersih (semua transaksi, termasuk refund)."""
        query = db.session.query(func.sum(Transaksi.jumlah)).filter(
            func.date(Transaksi.dibuat_pada) == tanggal
        )
        if kasir_id:
            query = query.filter(Transaksi.user_id == kasir_id)
        return query.scalar() or 0

    @staticmethod
    def get_total_pendapatan_by_tanggal(tanggal, jenis_list, kasir_id=None):
        """Total pendapatan berdasarkan tanggal dan jenis transaksi tertentu."""
        query = db.session.query(func.sum(Transaksi.jumlah)).filter(
            func.date(Transaksi.dibuat_pada) == tanggal,
            Transaksi.jenis.in_(jenis_list)
        )
        if kasir_id:
            query = query.filter(Transaksi.user_id == kasir_id)
        return query.scalar() or 0

    @staticmethod
    def count_by_date(tanggal):
        """Menghitung jumlah transaksi pada tanggal tertentu (untuk nomor nota)."""
        return db.session.query(func.count(Transaksi.id)).filter(
            func.date(Transaksi.dibuat_pada) == tanggal
        ).scalar() or 0

    @staticmethod
    def get_last_nota_today(date_str):
        """Ambil transaksi terakhir hari ini berdasarkan format nota TM-YYYYMMDD-."""
        prefix = f"TM-{date_str}-"
        return Transaksi.query.filter(
            Transaksi.no_nota.like(f"{prefix}%")
        ).order_by(Transaksi.no_nota.desc()).first()

    # get_income_by_type dipindah ke ReportService (Logic Mapping)

    @staticmethod
    def get_total_pemasukan(tanggal, kasir_id=None):
        """Alias untuk get_total_pemasukan_hari_ini"""
        return TransaksiRepository.get_total_pemasukan_hari_ini(tanggal, kasir_id)

    @staticmethod
    def get_total_refund(tanggal, kasir_id=None):
        """Alias untuk get_total_refund_hari_ini"""
        return TransaksiRepository.get_total_refund_hari_ini(tanggal, kasir_id)


    # =========================================================================
    # 4. UTILITAS (UTILITY)
    # =========================================================================

    @staticmethod
    def delete_all():
        """Menghapus riwayat transaksi (Tanpa Commit)."""
        deleted = Transaksi.query.delete()
        return deleted

    @staticmethod
    def delete_by_id(t_id):
        """Menghapus satu transaksi (Tanpa Commit)."""
        t = Transaksi.query.get(t_id)
        if t:
            db.session.delete(t)
            return True
        return False

    @staticmethod
    def delete_by_date(tanggal):
        """Menghapus transaksi per tanggal (Tanpa Commit)."""
        count = Transaksi.query.filter(func.date(Transaksi.dibuat_pada) == tanggal).delete()
        return count

    @staticmethod
    def get_distinct_tanggal():
        """Ambil daftar tanggal unik dari transaksi (untuk filter laporan)."""
        result = db.session.query(
            func.date(Transaksi.dibuat_pada).label('tgl')
        ).distinct().order_by(db.desc('tgl')).all()
        return [str(row[0]) for row in result if row[0]]