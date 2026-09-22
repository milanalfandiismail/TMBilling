# app/repositories/sesi_repository.py

"""Repository untuk entitas Sesi.

Modul ini mengelola operasi database untuk sesi bermain aktif,
termasuk logika kompleks blackout handling, transaksi atomik,
dan query untuk monitoring real-time.
"""

from datetime import datetime
from app.models import db, now_local
from app.models import Sesi
from app.models import Transaksi
from app.utils.logger import write_log
from sqlalchemy import func, or_, select


class SesiRepository:
    """Repository class untuk mengelola data Sesi bermain."""

    # =========================================================================
    # 1. PENGAMBILAN DATA (READ)
    # =========================================================================

    @staticmethod
    def get_by_id(sesi_id):
        """Mengambil sesi berdasarkan ID (404 jika tidak ditemukan)."""
        return Sesi.query.get_or_404(sesi_id)

    @staticmethod
    def get_aktif_by_pc(pc_id):
        """Mengambil sesi aktif pada PC tertentu."""
        return Sesi.query.filter_by(pc_id=pc_id, status="aktif").first()

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
        return Sesi.query.filter_by(status="aktif").all()
    
    @staticmethod
    def get_all_aktif_by_member(member_id):
        """Mengambil semua sesi aktif milik satu member (untuk validasi multi-login)."""
        return Sesi.query.filter_by(member_id=member_id, status="aktif").all()
    
    @staticmethod
    def get_active_admin_sessions():
        """Ambil semua sesi admin yang aktif."""
        return Sesi.query.filter_by(tipe="admin", status="aktif").all()

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


    @staticmethod
    def update_last_sync(sesi):
        """Memperbarui timestamp sinkronisasi terakhir sesi (Tanpa Commit)."""
        sesi.last_sync = now_local()





    # =========================================================================
    # 3. KONTROL SESI (LIFECYCLE)
    # =========================================================================

    @staticmethod
    def create_new_session(sesi_baru):
        """Menambahkan sesi baru ke session (Tanpa Commit)."""
        db.session.add(sesi_baru)
        return sesi_baru


    @staticmethod
    def close_session(sesi):
        """Menandai sesi selesai (Tanpa Commit)."""
        sesi.status = "selesai"
        sesi.selesai_pada = now_local()

    @staticmethod
    def force_close_all_sesi(now):
        """Menutup paksa semua sesi aktif (Tanpa Commit)."""
        sesi_list = Sesi.query.filter_by(status="aktif").all()
        for sesi in sesi_list:
            sesi.status = "selesai"
            sesi.selesai_pada = now
        return len(sesi_list)


    # =========================================================================
    # 4. LAPORAN & STATISTIK (REPORTING)
    # =========================================================================

    @staticmethod
    def get_by_tanggal(tanggal=None):
        """Mengambil semua sesi pada tanggal tertentu atau semua sesi jika tanggal None."""
        query = Sesi.query
        if tanggal and str(tanggal).strip().lower() not in ("all", "semua", "none", ""):
            from app.utils.timezone_utils import get_local_date_range_utc
            start_utc, end_utc = get_local_date_range_utc(tanggal)
            query = query.filter(
                Sesi.mulai_pada >= start_utc,
                Sesi.mulai_pada < end_utc
            )
        return query.order_by(Sesi.mulai_pada.desc()).all()

    @staticmethod
    def count_by_date(tanggal=None):
        """Menghitung total jumlah sesi pada tanggal tertentu atau semua sesi jika tanggal None."""
        query = Sesi.query
        if tanggal and str(tanggal).strip().lower() not in ("all", "semua", "none", ""):
            from app.utils.timezone_utils import get_local_date_range_utc
            start_utc, end_utc = get_local_date_range_utc(tanggal)
            query = query.filter(
                Sesi.mulai_pada >= start_utc,
                Sesi.mulai_pada < end_utc
            )
        return query.count()

    @staticmethod
    def get_selesai_by_tanggal(tanggal=None):
        """Mengambil sesi yang sudah selesai pada tanggal tertentu atau semua sesi selesai jika None."""
        query = Sesi.query.filter(Sesi.status == "selesai")
        if tanggal and str(tanggal).strip().lower() not in ("all", "semua", "none", ""):
            from app.utils.timezone_utils import get_local_date_range_utc
            start_utc, end_utc = get_local_date_range_utc(tanggal)
            query = query.filter(
                Sesi.mulai_pada >= start_utc,
                Sesi.mulai_pada < end_utc
            )
        return query.all()

    # get_total_menit_terbang dipindah ke ReportService (Logic Calculation)

    @staticmethod
    def get_distinct_tanggal():
        """Mengambil daftar tanggal unik dari sesi, transaksi, penjualan menu, dan tiket perbaikan untuk filter laporan (dalam display timezone)."""
        from app.utils.timezone_utils import convert_utc_datetimes_to_distinct_dates
        from app.models import TransaksiMenu, MaintenanceTicket
        
        # Ambil semua timestamp
        dt_sesi = [r[0] for r in db.session.query(Sesi.mulai_pada).filter(Sesi.mulai_pada != None).all()]
        dt_trans = [r[0] for r in db.session.query(Transaksi.dibuat_pada).filter(Transaksi.dibuat_pada != None).all()]
        dt_menu = [r[0] for r in db.session.query(TransaksiMenu.tanggal).filter(TransaksiMenu.tanggal != None).all()]
        dt_maint = [r[0] for r in db.session.query(MaintenanceTicket.resolved_at).filter(MaintenanceTicket.resolved_at != None).all()]
        
        all_dts = dt_sesi + dt_trans + dt_menu + dt_maint
        return convert_utc_datetimes_to_distinct_dates(all_dts)

    
    @staticmethod
    def count_by_tanggal_dan_tipe(tanggal=None, tipe=None):
        """Menghitung jumlah sesi pada tanggal tertentu (atau semua tanggal jika None) berdasarkan tipe.

        Args:
            tanggal (str, optional): Tanggal yang ingin dihitung (format 'YYYY-MM-DD'). Jika None, hitung semua tanggal.
            tipe (str, optional): Tipe sesi ('guest' atau 'member'). Jika None, hitung semua.

        Returns:
            int: Jumlah sesi yang sesuai.
        """
        query = Sesi.query
        if tanggal and str(tanggal).strip().lower() not in ("all", "semua", "none", ""):
            from app.utils.timezone_utils import get_local_date_range_utc
            start_utc, end_utc = get_local_date_range_utc(tanggal)
            query = query.filter(
                Sesi.mulai_pada >= start_utc,
                Sesi.mulai_pada < end_utc
            )
        if tipe:
            query = query.filter(Sesi.tipe == tipe)
        return query.count()

    @staticmethod
    def count_by_tanggal_tipe_kasir(tanggal, kasir_id, tipe=None):
        """Menghitung jumlah sesi yang memiliki transaksi dari kasir tertentu.

        Digunakan untuk laporan per-kasir: sesi dianggap 'milik kasir X' bila
        ada minimal satu Transaksi dengan user_id=kasir_id yang terkait ke sesi tsb.

        Args:
            tanggal (str, optional): Tanggal yang ingin dihitung (format 'YYYY-MM-DD'). Jika None, hitung semua tanggal.
            kasir_id (int): ID user kasir yang akan difilter.
            tipe (str, optional): Tipe sesi ('guest' atau 'member').

        Returns:
            int: Jumlah sesi yang sesuai.
        """
        where_clauses = [
            Transaksi.sesi_id.isnot(None)
        ]
        if tanggal and str(tanggal).strip().lower() not in ("all", "semua", "none", ""):
            from app.utils.timezone_utils import get_local_date_range_utc
            start_utc, end_utc = get_local_date_range_utc(tanggal)
            where_clauses.extend([
                Transaksi.dibuat_pada >= start_utc,
                Transaksi.dibuat_pada < end_utc,
            ])
        kasir_str = str(kasir_id).strip()
        if kasir_str.startswith("operator:"):
            target_op = kasir_str.split("operator:", 1)[1].strip()
            where_clauses.append(Transaksi.operator == target_op)
        elif "(Remote:" in kasir_str:
            where_clauses.append(Transaksi.operator == kasir_str)
        elif kasir_str.isdigit():
            uid = int(kasir_str)
            where_clauses.append(Transaksi.user_id == uid)
            where_clauses.append(
                db.or_(
                    Transaksi.operator == None,
                    Transaksi.operator == '',
                    ~Transaksi.operator.like('%(Remote:%')
                )
            )

        sesi_subq = (
            select(Transaksi.sesi_id)
            .where(*where_clauses)
            .distinct()
        )
        query = Sesi.query.filter(Sesi.id.in_(sesi_subq))
        if tipe:
            query = query.filter(Sesi.tipe == tipe)
        return query.count()


    # =========================================================================
    # 5. BLACKOUT & AUDIT LOG
    # =========================================================================

    @staticmethod
    def get_all_suspects():
        """Mengambil semua sesi yang dicurigai terdampak blackout."""
        return Sesi.query.filter_by(is_blackout_suspect=True).all()

    @staticmethod
    def get_by_audit_status(is_resolved):
        """Mengambil sesi blackout berdasarkan status resolusi."""
        return Sesi.query.filter_by(
            is_blackout_suspect=True,
            is_blackout_resolved=is_resolved
        ).all()

    @staticmethod
    def get_aktif_tanpa_sync(sejak):
        """Mengambil sesi aktif yang belum pernah mengirim sync atau sync terakhir sebelum batas waktu."""
        return Sesi.query.filter(
            Sesi.status == "aktif",
            or_(Sesi.last_sync == None, Sesi.last_sync < sejak)
        ).all()

    @staticmethod
    def get_aktif_belum_suspect_lama_sync(batas_waktu):
        """Ambil sesi aktif yang macet dengan validasi last_sync (wajib pernah sync)."""
        return Sesi.query.filter(
            Sesi.status == "aktif",
            Sesi.is_blackout_suspect == False,
            Sesi.last_sync.isnot(None),  # WAJIB sudah pernah sync minimal sekali
            Sesi.last_sync < batas_waktu
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