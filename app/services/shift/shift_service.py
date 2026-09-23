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
        from app.utils.validators import validate_integer_range
        modal_awal = validate_integer_range(modal_awal or 0, min_val=0, max_val=100_000_000, field_name="Modal Awal")

        kasir = User.query.filter_by(username=kasir_username).first()
        if not kasir:
            raise ValueError("Kasir tidak ditemukan")

        # Cek apakah sudah ada shift aktif
        aktif = ShiftRecord.query.filter_by(
            kasir_id=kasir.id, status="AKTIF"
        ).first()
        if aktif:
            raise ValueError(f"Kasir '{kasir_username}' sudah punya shift aktif sejak {format_display(aktif.waktu_mulai)}")

        shift = ShiftRecord(
            kasir_id=kasir.id,
            modal_awal=modal_awal,
            status="AKTIF",
        )
        db.session.add(shift)
        db.session.commit()

        from app.utils.logger import write_log
        
        detail_shift = {
            "kasir_username": kasir_username,
            "modal_awal": modal_awal
        }
        write_log("SHIFT_BUKA", f"Kasir:{kasir_username} | Modal:Rp{modal_awal:,}", user=operator, detail_json=detail_shift)

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
        """Hitung ringkasan pendapatan shift tanpa menyembunyikan angka.

        Args:
            shift_id: ID shift.

        Returns:
            dict: Ringkasan pendapatan shift.
        """
        shift = ShiftRecord.query.get(shift_id)
        if not shift:
            raise ValueError("Shift tidak ditemukan")

        waktu_akhir = shift.waktu_selesai or now_local()

        # Hitung billing PC dalam rentang shift (dibatasi hingga waktu_akhir)
        total_billing = db.session.query(
            db.func.coalesce(db.func.sum(Transaksi.jumlah), 0)
        ).filter(
            Transaksi.dibuat_pada >= shift.waktu_mulai,
            Transaksi.dibuat_pada <= waktu_akhir,
            Transaksi.user_id == shift.kasir_id,
            Transaksi.is_refunded == False,
            Transaksi.jenis.notin_(["tutup_sesi", "pindah_pc", "refund_paket"]),
        ).scalar()

        # Hitung refund dalam rentang shift
        total_refund = db.session.query(
            db.func.coalesce(db.func.sum(Transaksi.jumlah), 0)
        ).filter(
            Transaksi.dibuat_pada >= shift.waktu_mulai,
            Transaksi.dibuat_pada <= waktu_akhir,
            Transaksi.user_id == shift.kasir_id,
            Transaksi.jenis == "refund_paket",
        ).scalar()

        # Hitung kantin dalam rentang shift
        total_kantin = db.session.query(
            db.func.coalesce(db.func.sum(TransaksiMenu.total_harga), 0)
        ).filter(
            TransaksiMenu.tanggal >= shift.waktu_mulai,
            TransaksiMenu.tanggal <= waktu_akhir,
            TransaksiMenu.kasir_id == shift.kasir_id,
        ).scalar()

        # Hitung breakdown berdasarkan metode pembayaran
        billing_by_method = db.session.query(
            Transaksi.metode_pembayaran.label("method"),
            db.func.sum(Transaksi.jumlah).label("total")
        ).filter(
            Transaksi.dibuat_pada >= shift.waktu_mulai,
            Transaksi.dibuat_pada <= waktu_akhir,
            Transaksi.user_id == shift.kasir_id,
            Transaksi.is_refunded == False,
            Transaksi.jenis.notin_(["tutup_sesi", "pindah_pc", "refund_paket"]),
        ).group_by(Transaksi.metode_pembayaran).all()

        kantin_by_method = db.session.query(
            TransaksiMenu.metode_pembayaran.label("method"),
            db.func.sum(TransaksiMenu.total_harga).label("total")
        ).filter(
            TransaksiMenu.tanggal >= shift.waktu_mulai,
            TransaksiMenu.tanggal <= waktu_akhir,
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
        shift.total_qris = breakdown.get("QRIS", 0)
        shift.total_refund = total_refund
        db.session.commit()

        return {
            "shift_id": shift.id,
            "kasir_nama": shift.kasir.nama_lengkap or shift.kasir.username if shift.kasir else "System",
            "waktu_mulai": format_display(shift.waktu_mulai),
            "waktu_selesai": format_display(shift.waktu_selesai) if shift.waktu_selesai else None,
            "modal_awal": shift.modal_awal,
            "total_billing": shift.total_billing,
            "total_refund": total_refund,
            "total_kantin": shift.total_kantin,
            "total_pendapatan": shift.total_billing + shift.total_kantin,
            "total_seharusnya": shift.modal_awal + breakdown.get("Tunai", 0),
            "uang_fisik": shift.uang_fisik,
            "selisih": shift.selisih,
            "catatan": shift.catatan or "",
            "status": shift.status,
            "breakdown": breakdown
        }

    @staticmethod
    def end_shift(shift_id, uang_fisik, catatan=None, operator="system"):
        """Tutup shift dengan hitung buta dan serah terima.

        Kasir hanya memasukkan uang_fisik tanpa melihat angka pendapatan.
        Sistem menghitung selisih secara internal.

        Args:
            shift_id: ID shift yang akan ditutup.
            uang_fisik: Jumlah uang fisik yang dihitung kasir.
            catatan: Catatan penyerahan shift atau alasan selisih (opsional).
            operator: Pelaku aksi untuk logging.

        Returns:
            dict: Hasil penutupan shift (dengan selisih).

        Raises:
            ValueError: Jika shift tidak valid atau sudah ditutup.
        """
        from app.utils.validators import validate_integer_range, validate_string_length
        uang_fisik = validate_integer_range(uang_fisik or 0, min_val=0, max_val=100_000_000, field_name="Uang Fisik")
        if catatan:
            catatan = validate_string_length(catatan, min_len=0, max_len=255, field_name="Catatan Shift", required=False)

        shift = ShiftRecord.query.get(shift_id)
        if not shift:
            raise ValueError("Shift tidak ditemukan")
        if shift.status != "AKTIF":
            raise ValueError("Shift sudah ditutup sebelumnya")

        # Set waktu selesai sekarang
        shift.waktu_selesai = now_local()
        db.session.commit()

        # Hitung pendapatan dan selisih
        summary = ShiftService.get_shift_summary(shift_id)
        total_seharusnya = summary["total_seharusnya"]
        selisih = uang_fisik - total_seharusnya

        # Update shift record
        shift.uang_fisik = uang_fisik
        shift.selisih = selisih
        shift.catatan = (catatan or "").strip()
        shift.total_qris = summary["breakdown"].get("QRIS", 0)
        shift.total_refund = summary.get("total_refund", 0)
        shift.status = "SELESAI"
        db.session.commit()

        from app.utils.logger import write_log
        
        detail_shift = {
            "kasir_username": shift.kasir.username if shift.kasir else "System",
            "modal_awal": shift.modal_awal,
            "total_billing": summary['total_billing'],
            "total_kantin": summary['total_kantin'],
            "total_qris": shift.total_qris,
            "total_refund": shift.total_refund,
            "uang_fisik": uang_fisik,
            "selisih": selisih,
            "catatan": shift.catatan,
            "status": "SELESAI"
        }
        write_log(
            "SHIFT_TUTUP",
            f"Kasir:{detail_shift['kasir_username']} | "
            f"Modal:Rp{shift.modal_awal:,} | "
            f"Billing:Rp{summary['total_billing']:,} | "
            f"Kantin:Rp{summary['total_kantin']:,} | "
            f"QRIS:Rp{shift.total_qris:,} | "
            f"Fisik:Rp{uang_fisik:,} | "
            f"Selisih:Rp{selisih:+,} | "
            f"Catatan:{shift.catatan or '-'}",
            user=operator,
            detail_json=detail_shift
        )

        return {
            "id": shift.id,
            "kasir_nama": shift.kasir.nama_lengkap or shift.kasir.username if shift.kasir else "System",
            "waktu_mulai": format_display(shift.waktu_mulai),
            "waktu_selesai": format_display(shift.waktu_selesai),
            "modal_awal": shift.modal_awal,
            "total_billing": shift.total_billing,
            "total_kantin": shift.total_kantin,
            "total_qris": shift.total_qris,
            "total_refund": shift.total_refund,
            "total_pendapatan": shift.total_billing + shift.total_kantin,
            "uang_fisik": uang_fisik,
            "selisih": selisih,
            "catatan": shift.catatan or "",
            "status": "SELESAI",
        }

    @staticmethod
    def get_shift_history(kasir_id=None, limit=20, offset=0, tanggal_mulai=None, tanggal_selesai=None):
        """Ambil riwayat shift yang sudah selesai dengan pagination & filter tanggal.

        Args:
            kasir_id: Filter berdasarkan kasir (opsional).
            limit: Jumlah maksimal data per halaman.
            offset: Offset untuk pagination.
            tanggal_mulai: Filter tanggal mulai shift (datetime/str).
            tanggal_selesai: Filter tanggal selesai shift (datetime/str).

        Returns:
            dict: {"data": list of shift dict, "total": total records count}
        """
        query = ShiftRecord.query.filter_by(status="SELESAI")
        if kasir_id:
            query = query.filter_by(kasir_id=kasir_id)
        if tanggal_mulai:
            query = query.filter(ShiftRecord.waktu_mulai >= tanggal_mulai)
        if tanggal_selesai:
            query = query.filter(ShiftRecord.waktu_selesai <= tanggal_selesai)

        total = query.count()
        shifts = query.order_by(ShiftRecord.waktu_selesai.desc()).offset(offset).limit(limit).all()
        return {
            "data": [s.to_dict() for s in shifts],
            "total": total
        }

    @staticmethod
    def generate_shift_receipt_text(shift_id):
        """Menghasilkan teks struk serah terima shift untuk printer thermal 58mm (32 kolom).

        Args:
            shift_id: ID shift yang sudah selesai.

        Returns:
            str: Teks struk terformat siap cetak.
        """
        shift = ShiftRecord.query.get(shift_id)
        if not shift:
            raise ValueError("Shift tidak ditemukan")

        from app.services import SettingsService
        warnet_nama = SettingsService.get("warnet_name", "TM BILLING WARNET")

        kasir_nama = shift.kasir.nama_lengkap or shift.kasir.username if shift.kasir else "Kasir"
        w_mulai = format_display(shift.waktu_mulai)
        w_selesai = format_display(shift.waktu_selesai) if shift.waktu_selesai else "-"

        c_width = 32
        lines = []

        def center(text):
            return text.center(c_width)

        def row(left, right):
            space = c_width - len(str(left)) - len(str(right))
            if space < 1:
                return f"{left} {right}"
            return f"{left}{' ' * space}{right}"

        lines.append(center(warnet_nama.upper()))
        lines.append(center("STRUK SERAH TERIMA SHIFT"))
        lines.append("-" * c_width)
        lines.append(row("No Shift:", f"#{shift.id}"))
        lines.append(row("Kasir   :", kasir_nama[:18]))
        lines.append(row("Mulai   :", w_mulai))
        lines.append(row("Selesai :", w_selesai))
        lines.append("-" * c_width)
        lines.append(row("Modal Awal  :", f"Rp {shift.modal_awal:,.0f}"))
        lines.append(row("Pend.Billing:", f"Rp {shift.total_billing or 0:,.0f}"))
        lines.append(row("Pend.Kantin :", f"Rp {shift.total_kantin or 0:,.0f}"))
        if (shift.total_qris or 0) > 0:
            lines.append(row("Total QRIS  :", f"Rp {shift.total_qris:,.0f}"))
        if (shift.total_refund or 0) > 0:
            lines.append(row("Total Refund:", f"Rp {shift.total_refund:,.0f}"))
        lines.append("-" * c_width)
        tunai_seharusnya = shift.modal_awal + (shift.total_billing or 0) + (shift.total_kantin or 0) - (shift.total_qris or 0)
        lines.append(row("Uang Seharusnya:", f"Rp {tunai_seharusnya:,.0f}"))
        lines.append(row("Uang Fisik Laci:", f"Rp {shift.uang_fisik or 0:,.0f}"))
        
        selisih = shift.selisih or 0
        if selisih == 0:
            selisih_str = "Rp 0 (PAS)"
        elif selisih > 0:
            selisih_str = f"+Rp {selisih:,.0f} (LEBIH)"
        else:
            selisih_str = f"-Rp {abs(selisih):,.0f} (KURANG)"
        lines.append(row("Selisih Uang   :", selisih_str))

        if shift.catatan:
            lines.append("-" * c_width)
            lines.append("Catatan:")
            lines.append(shift.catatan)

        lines.append("=" * c_width)
        lines.append(center("Tanda Tangan Kasir"))
        lines.append("")
        lines.append("")
        lines.append(center(f"({kasir_nama})"))
        lines.append("-" * c_width)
        lines.append(center("SIMPAN STRUK INI UNTUK AUDIT"))
        lines.append("")

        return "\n".join(lines)
