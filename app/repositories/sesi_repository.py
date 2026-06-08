# app/repositories/sesi_repository.py

"""Repository untuk entitas Sesi.

Modul ini mengelola operasi database untuk sesi bermain aktif,
termasuk logika kompleks blackout handling, transaksi atomik,
dan query untuk monitoring real-time.
"""

from datetime import datetime
from app.models.base import db, now_local
from app.models.sesi import Sesi
from app.models.transaksi import Transaksi
from app.utils.logger import write_log
from sqlalchemy import func, or_


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
    def get_by_tanggal(tanggal):
        """Mengambil semua sesi pada tanggal tertentu (diurutkan terbaru)."""
        return Sesi.query.filter(
            db.func.date(Sesi.mulai_pada) == tanggal
        ).order_by(Sesi.mulai_pada.desc()).all()

    @staticmethod
    def count_by_date(tanggal):
        """Menghitung total jumlah sesi pada tanggal tertentu."""
        return Sesi.query.filter(
            db.func.date(Sesi.mulai_pada) == tanggal
        ).count()

    @staticmethod
    def get_selesai_by_tanggal(tanggal):
        """Mengambil sesi yang sudah selesai pada tanggal tertentu."""
        return Sesi.query.filter(
            func.date(Sesi.mulai_pada) == tanggal,
            Sesi.status == "selesai"
        ).all()

    # get_total_menit_terbang dipindah ke ReportService (Logic Calculation)

    @staticmethod
    def get_distinct_tanggal():
        """Mengambil daftar tanggal unik dari sesi dan transaksi untuk filter laporan."""
        # Ambil tanggal unik dari Sesi
        dates_sesi = db.session.query(func.date(Sesi.mulai_pada)).distinct()
        # Ambil tanggal unik dari Transaksi
        dates_trans = db.session.query(func.date(Transaksi.dibuat_pada)).distinct()
        
        # Union dan sort
        all_dates = dates_sesi.union(dates_trans).all()
        
        # Flatten and format as string, filter None
        result = sorted([str(row[0]) for row in all_dates if row[0]], reverse=True)
        return result

    
    @staticmethod
    def count_by_tanggal_dan_tipe(tanggal, tipe=None):
        """Menghitung jumlah sesi pada tanggal tertentu berdasarkan tipe.
        
        Args:
            tanggal (str): Tanggal yang ingin dihitung (format 'YYYY-MM-DD').
            tipe (str, optional): Tipe sesi ('guest' atau 'member'). Jika None, hitung semua.
            
        Returns:
            int: Jumlah sesi yang sesuai.
        """
        query = Sesi.query.filter(func.date(Sesi.mulai_pada) == tanggal)
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
        query = Sesi.query.filter_by(is_blackout_suspect=True)
        if selected_date:
            query = query.filter(func.date(Sesi.mulai_pada) == selected_date)
        return query.order_by(Sesi.mulai_pada.desc()).all()

    @staticmethod
    def get_blackout_audit_dates():
        """Mengambil daftar tanggal unik yang memiliki catatan insiden blackout."""
        try:
            rows = db.session.query(func.date(Sesi.mulai_pada)) \
                .filter_by(is_blackout_suspect=True) \
                .distinct() \
                .order_by(func.date(Sesi.mulai_pada).desc()) \
                .all()
            result = []
            for row in rows:
                if row and row[0]:
                    d = row[0]
                    result.append(d if isinstance(d, str) else d.strftime("%Y-%m-%d"))
            return result
        except Exception as e:
            write_log("DB_ERROR", f"get_blackout_audit_dates: {e}")
            return []

    @staticmethod
    def delete_resolved_blackout(selected_date):
        """Menghapus record blackout (Tanpa Commit)."""
        deleted = Sesi.query.filter(
            Sesi.is_blackout_suspect == True,
            Sesi.is_blackout_resolved == True,
            func.date(Sesi.mulai_pada) == selected_date
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
        deleted = Sesi.query.filter(
            Sesi.status != 'aktif',
            func.date(Sesi.mulai_pada) == tanggal
        ).delete()
        return deleted



    # =========================================================================
    # 6. UTILITIES
    # =========================================================================