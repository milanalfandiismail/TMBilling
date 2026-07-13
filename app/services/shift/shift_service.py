"""Service untuk manajemen shift kasir (Handover).

Modul ini menangani business logic shift: buka shift, hitung pendapatan,
tutup shift dengan hitung buta, dan cetak struk handover.
"""

from app.models import db, now_local
from app.models import ShiftRecord, Transaksi, TransaksiMenu, User
from app.utils.timezone_utils import format_display


class ShiftService:
    """Service untuk business logic Shift Kasir."""

    @staticmethod
    def get_user_id(identifier):
        """Cari user ID berdasarkan username atau nama_lengkap."""
        if not identifier or identifier == "system":
            return None
        user = User.query.filter(
            (User.username == identifier) | (User.nama_lengkap == identifier)
        ).first()
        return user.id if user else None

    @staticmethod
    def start_shift(kasir_username, modal_awal=0, operator="system"):
        """Buka shift baru untuk kasir.

        Args:
            kasir_username: Username kasir.
            modal_awal: Uang kembalian di laci (default 0).
            operator: Pelaku aksi untuk logging.

        Returns:
            ShiftRecord: Objek shift yang baru dibuat.

        Raises:
            ValueError: Jika kasir sudah punya shift aktif.
        """
        kasir = User.query.filter_by(username=kasir_username).first()
        if not kasir:
            raise ValueError("Kasir tidak ditemukan")

        # Cek apakah sudah ada shift aktif
        aktif = ShiftRecord.query.filter_by(
            kasir_id=kasir.id, status="AKTIF"
        ).first()
        if aktif:
            raise ValueError(f"Kasir '{kasir_username}' sudah punya shift aktif sejak {format_display(aktif.waktu_mulai)}")

        if modal_awal < 0:
            raise ValueError("Modal awal tidak boleh negatif")

        shift = ShiftRecord(
            kasir_id=kasir.id,
            modal_awal=modal_awal,
            status="AKTIF",
        )
        db.session.add(shift)
        db.session.commit()

        from app.utils.logger import write_log
        write_log("SHIFT_BUKA", f"Kasir:{kasir_username} | Modal:Rp{modal_awal:,}", user=operator)

        return shift

    @staticmethod
    def get_active_shift(kasir_username):
        """Ambil shift aktif milik kasir.

        Args:
            kasir_username: Username kasir.

        Returns:
            ShiftRecord atau None.
        """
        kasir = User.query.filter_by(username=kasir_username).first()
        if not kasir:
            return None
        return ShiftRecord.query.filter_by(
            kasir_id=kasir.id, status="AKTIF"
        ).first()

    @staticmethod
    def get_shift_summary(shift_id):
        """Hitung ringkasan pendapatan shift tanpa menyembunyikan angka (untuk admin).

        Args:
            shift_id: ID shift.

        Returns:
            dict: Ringkasan pendapatan shift.
        """
        shift = ShiftRecord.query.get(shift_id)
        if not shift:
            raise ValueError("Shift tidak ditemukan")

        # Hitung billing PC dalam rentang shift
        total_billing = db.session.query(
            db.func.coalesce(db.func.sum(Transaksi.jumlah), 0)
        ).filter(
            Transaksi.dibuat_pada >= shift.waktu_mulai,
            Transaksi.user_id == shift.kasir_id,
            Transaksi.is_refunded == False,
            Transaksi.jenis.notin_(["tutup_sesi", "pindah_pc", "refund_paket"]),
        ).scalar()

        # Hitung refund
        total_refund = db.session.query(
            db.func.coalesce(db.func.sum(Transaksi.jumlah), 0)
        ).filter(
            Transaksi.dibuat_pada >= shift.waktu_mulai,
            Transaksi.user_id == shift.kasir_id,
            Transaksi.jenis == "refund_paket",
        ).scalar()

        # Hitung kantin dalam rentang shift
        total_kantin = db.session.query(
            db.func.coalesce(db.func.sum(TransaksiMenu.total_harga), 0)
        ).filter(
            TransaksiMenu.tanggal >= shift.waktu_mulai,
            TransaksiMenu.kasir_id == shift.kasir_id,
        ).scalar()

        # Hitung breakdown berdasarkan metode pembayaran
        billing_by_method = db.session.query(
            Transaksi.metode_pembayaran.label("method"),
            db.func.sum(Transaksi.jumlah).label("total")
        ).filter(
            Transaksi.dibuat_pada >= shift.waktu_mulai,
            Transaksi.user_id == shift.kasir_id,
            Transaksi.is_refunded == False,
            Transaksi.jenis.notin_(["tutup_sesi", "pindah_pc", "refund_paket"]),
        ).group_by(Transaksi.metode_pembayaran).all()

        kantin_by_method = db.session.query(
            TransaksiMenu.metode_pembayaran.label("method"),
            db.func.sum(TransaksiMenu.total_harga).label("total")
        ).filter(
            TransaksiMenu.tanggal >= shift.waktu_mulai,
            TransaksiMenu.kasir_id == shift.kasir_id,
        ).group_by(TransaksiMenu.metode_pembayaran).all()

        breakdown = {}
        for row in billing_by_method:
            method = row.method
            if method in ["Cash", "Tunai", "None", None]:
                method = "Tunai"
            breakdown[method] = breakdown.get(method, 0) + row.total

        for row in kantin_by_method:
            method = row.method
            if method in ["Cash", "Tunai", "None", None]:
                method = "Tunai"
            breakdown[method] = breakdown.get(method, 0) + row.total

        # Subtract refund from Tunai
        breakdown["Tunai"] = breakdown.get("Tunai", 0) - total_refund

        # Update field di shift (disimpan untuk audit)
        shift.total_billing = total_billing - total_refund
        shift.total_kantin = total_kantin
        db.session.commit()

        return {
            "shift_id": shift.id,
            "kasir_nama": shift.kasir.nama_lengkap or shift.kasir.username,
            "waktu_mulai": format_display(shift.waktu_mulai),
            "modal_awal": shift.modal_awal,
            "total_billing": shift.total_billing,
            "total_refund": total_refund,
            "total_kantin": shift.total_kantin,
            "total_pendapatan": shift.total_billing + shift.total_kantin,
            "total_seharusnya": shift.modal_awal + breakdown.get("Tunai", 0),
            "uang_fisik": shift.uang_fisik,
            "selisih": shift.selisih,
            "status": shift.status,
            "breakdown": breakdown
        }

    @staticmethod
    def end_shift(shift_id, uang_fisik, operator="system"):
        """Tutup shift dengan hitung buta.

        Kasir hanya memasukkan uang_fisik tanpa melihat angka pendapatan.
        Sistem menghitung selisih secara internal.

        Args:
            shift_id: ID shift yang akan ditutup.
            uang_fisik: Jumlah uang fisik yang dihitung kasir.
            operator: Pelaku aksi untuk logging.

        Returns:
            dict: Hasil penutupan shift (dengan selisih).

        Raises:
            ValueError: Jika shift tidak valid atau sudah ditutup.
        """
        shift = ShiftRecord.query.get(shift_id)
        if not shift:
            raise ValueError("Shift tidak ditemukan")
        if shift.status != "AKTIF":
            raise ValueError("Shift sudah ditutup sebelumnya")

        if uang_fisik < 0:
            raise ValueError("Uang fisik tidak boleh negatif")

        # Hitung pendapatan dulu
        summary = ShiftService.get_shift_summary(shift_id)

        # Hitung selisih
        total_seharusnya = summary["total_seharusnya"]
        selisih = uang_fisik - total_seharusnya

        # Update shift
        shift.uang_fisik = uang_fisik
        shift.selisih = selisih
        shift.waktu_selesai = now_local()
        shift.status = "SELESAI"
        db.session.commit()

        from app.utils.logger import write_log
        write_log(
            "SHIFT_TUTUP",
            f"Kasir:{shift.kasir.username} | "
            f"Modal:{shift.modal_awal:,} | "
            f"Billing:{summary['total_billing']:,} | "
            f"Kantin:{summary['total_kantin']:,} | "
            f"Fisik:{uang_fisik:,} | "
            f"Selisih:{selisih:+,}",
            user=operator,
        )

        return {
            "id": shift.id,
            "kasir_nama": shift.kasir.nama_lengkap or shift.kasir.username,
            "waktu_mulai": format_display(shift.waktu_mulai),
            "waktu_selesai": format_display(shift.waktu_selesai),
            "modal_awal": shift.modal_awal,
            "total_billing": shift.total_billing,
            "total_kantin": shift.total_kantin,
            "total_pendapatan": shift.total_billing + shift.total_kantin,
            "uang_fisik": uang_fisik,
            "selisih": selisih,
            "status": "SELESAI",
        }

    @staticmethod
    def get_shift_history(kasir_id=None, limit=10):
        """Ambil riwayat shift yang sudah selesai.

        Args:
            kasir_id: Filter berdasarkan kasir (opsional).
            limit: Jumlah maksimal data.

        Returns:
            list: Daftar shift selesai.
        """
        query = ShiftRecord.query.filter_by(status="SELESAI")
        if kasir_id:
            query = query.filter_by(kasir_id=kasir_id)
        shifts = query.order_by(ShiftRecord.waktu_selesai.desc()).limit(limit).all()
        return [s.to_dict() for s in shifts]
