# app/repositories/sesi_repository.py

"""Repository untuk entitas Sesi.

Modul ini mengelola operasi database untuk sesi bermain aktif,
termasuk logika kompleks blackout handling, transaksi atomik,
dan query untuk monitoring real-time.
"""

from datetime import datetime
from app.models import db, now_local
from app.models import Sesi
from app.models import Member
from app.models import Transaksi
from app.utils.logger import write_log
from sqlalchemy import func, select, or_, and_
from sqlalchemy.orm import joinedload


class SesiRepository:
    """Repository class untuk mengelola data Sesi bermain."""

    # =========================================================================
    # 1. PENGAMBILAN DATA (READ)
    # =========================================================================

    @staticmethod
    def get_by_id(sesi_id):
        """Mengambil sesi berdasarkan ID, None jika tidak ditemukan."""
        return db.session.get(Sesi, sesi_id)

    @staticmethod
    def get_aktif_by_pc(pc_id):
        """Mengambil sesi aktif pada PC tertentu (member & grup sekaligus)."""
        return (Sesi.query
                .options(joinedload(Sesi.member).joinedload(Member.grup))
                .filter_by(pc_id=pc_id, status="aktif").first())

    @staticmethod
    def get_aktif_by_id(sesi_id):
        """Mengambil sesi yang masih aktif berdasarkan ID."""
        return Sesi.query.filter_by(id=sesi_id, status="aktif").first()

    @staticmethod
    def get_aktif_by_member(member_id):
        """Mengambil sesi aktif milik member tertentu."""
        return Sesi.query.filter_by(member_id=member_id, status="aktif").first()

    @staticmethod
    def get_aktif_by_paket(paket_id):
        """Mengecek apakah ada sesi aktif yang menggunakan paket tertentu."""
        return Sesi.query.filter_by(paket_id=paket_id, status="aktif").first()

    @staticmethod
    def get_all_aktif():
        """Mengambil semua sesi yang sedang aktif."""
        return Sesi.query.options(
            joinedload(Sesi.member),
            joinedload(Sesi.user),
            joinedload(Sesi.paket)
        ).filter_by(status="aktif").all()

    @staticmethod
    def count_aktif():
        """Jumlah sesi aktif tanpa memuat barisnya."""
        return Sesi.query.filter_by(status="aktif").count()

    @staticmethod
    def get_all_aktif_by_member(member_id):
        """Mengambil semua sesi aktif milik satu member (untuk validasi multi-login)."""
        return Sesi.query.filter_by(member_id=member_id, status="aktif").all()
    
    @staticmethod
    def has_history_for_member(member_id):
        """True bila member pernah punya sesi (aktif maupun selesai)."""
        return Sesi.query.filter_by(member_id=member_id).first() is not None

    @staticmethod
    def get_history_by_member(member_id, limit=10):
        """Mengambil riwayat sesi bermain member terurut dari yang terbaru."""
        return Sesi.query.filter_by(member_id=member_id).order_by(Sesi.mulai_pada.desc()).limit(limit).all()



    # =========================================================================
    # 2. PROSES SIMPAN & UPDATE (WRITE)
    # =========================================================================

    @staticmethod
    def save(sesi):
        """Menambahkan sesi ke database (Tanpa Commit)."""
        db.session.add(sesi)

    @staticmethod
    def add(entity):
        """Menambahkan entitas ke session (tanpa commit)."""
        db.session.add(entity)

    @staticmethod
    def flush():
        """Melakukan flush untuk mendapatkan ID yang di-generate DB."""
        db.session.flush()





    # =========================================================================
    # 3. KONTROL SESI (LIFECYCLE)
    # =========================================================================

    @staticmethod
    def close_session(sesi):
        """Menandai sesi selesai (Tanpa Commit)."""
        sesi.status = "selesai"
        sesi.selesai_pada = now_local()
        sesi.is_afk = False
        sesi.afk_pin = None
        sesi.afk_sejak = None

    @staticmethod
    def close_active_admin_sessions_for_pc(pc_id):
        """Menutup sesi admin aktif pada satu PC (Tanpa Commit)."""
        sesi_list = Sesi.query.filter_by(pc_id=pc_id, tipe="admin", status="aktif").all()
        for sesi in sesi_list:
            SesiRepository.close_session(sesi)
        return len(sesi_list)


    # =========================================================================
    # 4. LAPORAN & STATISTIK (REPORTING)
    # =========================================================================

    @staticmethod
    def count_by_date(tanggal=None):
        """Menghitung total jumlah sesi pada tanggal tertentu atau semua sesi jika tanggal None."""
        query = Sesi.query.filter(Sesi.tipe.in_(("guest", "member")))
        if tanggal and str(tanggal).strip().lower() not in ("all", "semua", "none", ""):
            from app.utils.timezone_utils import get_local_date_range_utc
            start_utc, end_utc = get_local_date_range_utc(tanggal)
            query = query.filter(
                Sesi.mulai_pada >= start_utc,
                Sesi.mulai_pada < end_utc
            )
        return query.count()

    # get_total_menit_terbang dipindah ke ReportService (Logic Calculation)

    @staticmethod
    def get_distinct_tanggal(tz_name=None):
        """Mengambil daftar tanggal unik dari sesi, transaksi, dan penjualan menu untuk filter laporan (dalam display timezone)."""
        from app.utils.timezone_utils import local_date_modifier
        from app.models import TransaksiMenu

        mod = local_date_modifier(tz_name)
        tanggal = set()
        for kolom in (Sesi.mulai_pada, Transaksi.dibuat_pada, TransaksiMenu.tanggal):
            rows = (db.session.query(func.date(kolom, mod))
                    .filter(kolom.isnot(None)).distinct().all())
            tanggal.update(r[0] for r in rows if r[0])
        return sorted(tanggal, reverse=True)

    
    @staticmethod
    def get_aktif_belum_suspect_lama_sync(batas_waktu):
        """Ambil sesi aktif yang macet berdasarkan last_sync atau waktu mulai."""
        # Sesi yang mati sebelum heartbeat pertama tidak punya last_sync.
        return Sesi.query.filter(
            Sesi.status == "aktif",
            Sesi.is_blackout_suspect == False,
            or_(
                Sesi.last_sync < batas_waktu,
                and_(Sesi.last_sync.is_(None), Sesi.mulai_pada < batas_waktu),
            ),
        ).all()

    @staticmethod
    def get_blackout_audit_list(selected_date=None):
        """Mengambil daftar sesi blackout untuk halaman audit (dengan filter tanggal)."""
        from app.utils.timezone_utils import get_local_date_range_utc
        query = Sesi.query.filter_by(is_blackout_suspect=True)
        if selected_date:
            start_utc, end_utc = get_local_date_range_utc(selected_date)
            query = query.filter(
                Sesi.mulai_pada >= start_utc,
                Sesi.mulai_pada < end_utc
            )
        return query.order_by(Sesi.mulai_pada.desc()).all()

    @staticmethod
    def get_blackout_audit_dates():
        """Mengambil daftar tanggal unik yang memiliki catatan insiden blackout."""
        from app.utils.timezone_utils import convert_utc_datetimes_to_distinct_dates
        try:
            rows = db.session.query(Sesi.mulai_pada) \
                .filter_by(is_blackout_suspect=True) \
                .all()
            return convert_utc_datetimes_to_distinct_dates([r[0] for r in rows if r[0]])
        except Exception as e:
            write_log("DB_ERROR", f"get_blackout_audit_dates: {e}")
            return []

    @staticmethod
    def delete_resolved_blackout(selected_date):
        """Menghapus record blackout (Tanpa Commit)."""
        from app.utils.timezone_utils import get_local_date_range_utc
        start_utc, end_utc = get_local_date_range_utc(selected_date)
        deleted = Sesi.query.filter(
            Sesi.is_blackout_suspect == True,
            Sesi.is_blackout_resolved == True,
            Sesi.mulai_pada >= start_utc,
            Sesi.mulai_pada < end_utc
        ).delete()
        return deleted

    @staticmethod
    def delete_history():
        """Menghapus riwayat sesi (Tanpa Commit)."""
        deleted = Sesi.query.filter(Sesi.status != 'aktif').delete()
        return deleted

    @staticmethod
    def delete_history_by_date(tanggal):
        """Menghapus riwayat per tanggal (Tanpa Commit)."""
        from app.utils.timezone_utils import get_local_date_range_utc
        start_utc, end_utc = get_local_date_range_utc(tanggal)
        deleted = Sesi.query.filter(
            Sesi.status != 'aktif',
            Sesi.mulai_pada >= start_utc,
            Sesi.mulai_pada < end_utc
        ).delete()
        return deleted



    # =========================================================================
    # 6. UTILITIES
    # =========================================================================