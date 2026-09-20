# app/repositories/transaksi_repository.py

"""Repository untuk entitas Transaksi.

Modul ini mengelola operasi database untuk pencatatan keuangan
termasuk kalkulasi pendapatan dan histori pembelian.
"""

from app.models import db
from app.models import Transaksi
from app.models import Sesi
from app.models import Member
from app.models import PC
from sqlalchemy import func, or_


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
    def get_paginated_by_member(member_id, page=1, per_page=10):
        """Ambil riwayat transaksi member terpaginasi."""
        return Transaksi.query.filter_by(member_id=member_id).order_by(
            Transaksi.dibuat_pada.desc()
        ).paginate(page=page, per_page=per_page, error_out=False)


    @staticmethod
    def get_riwayat_paket_sesi(sesi_id):
        """Ambil riwayat paket sesi yang belum direfund (untuk guest refund)."""
        return Transaksi.query.filter(
            Transaksi.sesi_id == sesi_id,
            Transaksi.jenis.in_(["beli_paket_guest", "tambah_waktu_guest"]),
            Transaksi.is_refunded == False
        ).order_by(Transaksi.dibuat_pada.desc()).all()

    @staticmethod
    def _apply_kasir_filter(query, kasir_id):
        """Menerapkan filter kasir secara akurat (lokal vs remote operator)."""
        if not kasir_id or str(kasir_id).strip().lower() in ["", "semua", "none"]:
            return query
        kasir_str = str(kasir_id).strip()
        if kasir_str.startswith("operator:"):
            target_op = kasir_str.split("operator:", 1)[1].strip()
            return query.filter(Transaksi.operator == target_op)
        if "(Remote:" in kasir_str:
            return query.filter(Transaksi.operator == kasir_str)
        if kasir_str.isdigit():
            uid = int(kasir_str)
            return query.filter(
                Transaksi.user_id == uid,
                db.or_(
                    Transaksi.operator == None,
                    Transaksi.operator == '',
                    ~Transaksi.operator.like('%(Remote:%')
                )
            )
        return query

    @staticmethod
    def get_distinct_remote_operators():
        """Mengambil nama operator remote unik dari transaksi."""
        results = db.session.query(Transaksi.operator).filter(
            Transaksi.operator.like('%(Remote:%')
        ).distinct().all()
        return [r[0] for r in results if r[0]]

    @staticmethod
    def get_all_by_tanggal_with_nota(tanggal=None, kasir_id=None):
        """Pusat query transaksi harian yang ada nomor notanya."""
        query = Transaksi.query.filter(Transaksi.no_nota != None)
        if tanggal and str(tanggal).strip().lower() not in ("all", "semua", "none", ""):
            from app.utils.timezone_utils import get_local_date_range_utc
            start_utc, end_utc = get_local_date_range_utc(tanggal)
            query = query.filter(
                Transaksi.dibuat_pada >= start_utc,
                Transaksi.dibuat_pada < end_utc
            )
        query = TransaksiRepository._apply_kasir_filter(query, kasir_id)
        return query.order_by(Transaksi.dibuat_pada.desc()).all()

    @staticmethod
    def get_history_nota_by_date(tanggal=None, kasir_id=None):
        """Alias untuk get_all_by_tanggal_with_nota"""
        return TransaksiRepository.get_all_by_tanggal_with_nota(tanggal, kasir_id)

    @staticmethod
    def get_history_nota_paginated(tanggal=None, page=1, per_page=10, kasir_id=None, metode_pembayaran=None, q=None):
        """Ambil histori nota dengan pagination dan pencarian query."""
        query = Transaksi.query.filter(Transaksi.no_nota != None)
        if tanggal and str(tanggal).strip().lower() not in ("all", "semua", "none", ""):
            from app.utils.timezone_utils import get_local_date_range_utc
            start_utc, end_utc = get_local_date_range_utc(tanggal)
            query = query.filter(
                Transaksi.dibuat_pada >= start_utc,
                Transaksi.dibuat_pada < end_utc
            )
        query = TransaksiRepository._apply_kasir_filter(query, kasir_id)
        if metode_pembayaran:
            if metode_pembayaran == "Tunai":
                query = query.filter(
                    (Transaksi.metode_pembayaran.in_(["Tunai", "Cash"])) | 
                    (Transaksi.metode_pembayaran == None)
                )
            else:
                query = query.filter(Transaksi.metode_pembayaran == metode_pembayaran)
        
        if q:
            search = f"%{q}%"
            query = query.outerjoin(Transaksi.member).outerjoin(Transaksi.sesi).outerjoin(Sesi.pc).filter(
                or_(
                    Transaksi.no_nota.ilike(search),
                    Transaksi.keterangan.ilike(search),
                    Member.username.ilike(search),
                    Member.nama_lengkap.ilike(search),
                    Sesi.nama_guest.ilike(search),
                    PC.kode.ilike(search),
                    PC.nama.ilike(search)
                )
            )
        
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
    def get_total_pemasukan_hari_ini(tanggal=None, kasir_id=None, metode_pembayaran=None):
        """Total pemasukan (jumlah > 0, tanpa refund)."""
        query = db.session.query(func.sum(Transaksi.jumlah)).filter(
            Transaksi.jumlah > 0
        )
        if tanggal and str(tanggal).strip().lower() not in ("all", "semua", "none", ""):
            from app.utils.timezone_utils import get_local_date_range_utc
            start_utc, end_utc = get_local_date_range_utc(tanggal)
            query = query.filter(
                Transaksi.dibuat_pada >= start_utc,
                Transaksi.dibuat_pada < end_utc
            )
        query = TransaksiRepository._apply_kasir_filter(query, kasir_id)
        if metode_pembayaran:
            if metode_pembayaran == "Tunai":
                query = query.filter(
                    (Transaksi.metode_pembayaran.in_(["Tunai", "Cash"])) | 
                    (Transaksi.metode_pembayaran == None)
                )
            else:
                query = query.filter(Transaksi.metode_pembayaran == metode_pembayaran)
        return query.scalar() or 0

    @staticmethod
    def get_total_refund_hari_ini(tanggal=None, kasir_id=None, metode_pembayaran=None):
        """Total refund (nilai positif)."""
        query = db.session.query(func.sum(Transaksi.jumlah)).filter(
            Transaksi.jenis == "refund_paket"
        )
        if tanggal and str(tanggal).strip().lower() not in ("all", "semua", "none", ""):
            from app.utils.timezone_utils import get_local_date_range_utc
            start_utc, end_utc = get_local_date_range_utc(tanggal)
            query = query.filter(
                Transaksi.dibuat_pada >= start_utc,
                Transaksi.dibuat_pada < end_utc
            )
        query = TransaksiRepository._apply_kasir_filter(query, kasir_id)
        if metode_pembayaran:
            if metode_pembayaran == "Tunai":
                query = query.filter(
                    (Transaksi.metode_pembayaran.in_(["Tunai", "Cash"])) | 
                    (Transaksi.metode_pembayaran == None)
                )
            else:
                query = query.filter(Transaksi.metode_pembayaran == metode_pembayaran)
        refund = query.scalar() or 0
        return abs(refund)

    @staticmethod
    def get_total_pendapatan_hari_ini(tanggal=None, kasir_id=None):
        """Total pendapatan bersih (semua transaksi, termasuk refund)."""
        query = db.session.query(func.sum(Transaksi.jumlah))
        if tanggal and str(tanggal).strip().lower() not in ("all", "semua", "none", ""):
            from app.utils.timezone_utils import get_local_date_range_utc
            start_utc, end_utc = get_local_date_range_utc(tanggal)
            query = query.filter(
                Transaksi.dibuat_pada >= start_utc,
                Transaksi.dibuat_pada < end_utc
            )
        query = TransaksiRepository._apply_kasir_filter(query, kasir_id)
        return query.scalar() or 0

    @staticmethod
    def get_total_pendapatan_by_tanggal(tanggal=None, jenis_list=None, kasir_id=None, metode_pembayaran=None):
        """Total pendapatan berdasarkan tanggal dan jenis transaksi tertentu."""
        query = db.session.query(func.sum(Transaksi.jumlah))
        if jenis_list:
            query = query.filter(Transaksi.jenis.in_(jenis_list))
        if tanggal and str(tanggal).strip().lower() not in ("all", "semua", "none", ""):
            from app.utils.timezone_utils import get_local_date_range_utc
            start_utc, end_utc = get_local_date_range_utc(tanggal)
            query = query.filter(
                Transaksi.dibuat_pada >= start_utc,
                Transaksi.dibuat_pada < end_utc
            )
        query = TransaksiRepository._apply_kasir_filter(query, kasir_id)
        if metode_pembayaran:
            if metode_pembayaran == "Tunai":
                query = query.filter(
                    (Transaksi.metode_pembayaran.in_(["Tunai", "Cash"])) | 
                    (Transaksi.metode_pembayaran == None)
                )
            else:
                query = query.filter(Transaksi.metode_pembayaran == metode_pembayaran)
        return query.scalar() or 0

    @staticmethod
    def count_by_date(tanggal=None):
        """Menghitung jumlah transaksi pada tanggal tertentu (untuk nomor nota)."""
        query = db.session.query(func.count(Transaksi.id))
        if tanggal and str(tanggal).strip().lower() not in ("all", "semua", "none", ""):
            from app.utils.timezone_utils import get_local_date_range_utc
            start_utc, end_utc = get_local_date_range_utc(tanggal)
            query = query.filter(
                Transaksi.dibuat_pada >= start_utc,
                Transaksi.dibuat_pada < end_utc
            )
        return query.scalar() or 0

    @staticmethod
    def get_last_nota_today(date_str):
        """Ambil transaksi terakhir hari ini berdasarkan format nota TM-YYYYMMDD-."""
        prefix = f"TM-{date_str}-"
        return Transaksi.query.filter(
            Transaksi.no_nota.like(f"{prefix}%")
        ).order_by(Transaksi.no_nota.desc()).first()

    # get_income_by_type dipindah ke ReportService (Logic Mapping)

    @staticmethod
    def get_total_pemasukan(tanggal, kasir_id=None, metode_pembayaran=None):
        """Alias untuk get_total_pemasukan_hari_ini"""
        return TransaksiRepository.get_total_pemasukan_hari_ini(tanggal, kasir_id, metode_pembayaran)

    @staticmethod
    def get_total_refund(tanggal, kasir_id=None, metode_pembayaran=None):
        """Alias untuk get_total_refund_hari_ini"""
        return TransaksiRepository.get_total_refund_hari_ini(tanggal, kasir_id, metode_pembayaran)


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
        from app.utils.timezone_utils import get_local_date_range_utc
        start_utc, end_utc = get_local_date_range_utc(tanggal)
        count = Transaksi.query.filter(
            Transaksi.dibuat_pada >= start_utc,
            Transaksi.dibuat_pada < end_utc
        ).delete()
        return count

    @staticmethod
    def get_distinct_tanggal():
        """Ambil daftar tanggal unik dari transaksi (dalam display timezone untuk filter laporan)."""
        from app.utils.timezone_utils import convert_utc_datetimes_to_distinct_dates
        result = db.session.query(Transaksi.dibuat_pada).filter(Transaksi.dibuat_pada != None).all()
        return convert_utc_datetimes_to_distinct_dates([row[0] for row in result if row[0]])