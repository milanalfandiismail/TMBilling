# app/services/report_service.py

"""Service untuk laporan dan agregasi data keuangan/billing.

Modul ini menangani agregasi pendapatan harian, histori struk,
laporan kantin F&B, dan pencarian transaksi. Logika PDF dan Log Audit
dipisahkan ke PdfExportService dan LogAuditService.
"""

from datetime import datetime
from app.models import now_local
from app.repositories import TransaksiRepository, SesiRepository, SettingsRepository, MenuRepository, UserRepository
from app.utils.timezone_utils import format_display
from app.services.report.log_audit_service import LogAuditService
from app.services.report.pdf_export_service import PdfExportService


class ReportService:
    """Service untuk business logic laporan keuangan & operasional."""

    # =========================================================================
    # 1. LAPORAN KEUANGAN & OPERASIONAL (FINANCIAL)
    # =========================================================================

    @staticmethod
    def get_laporan_harian():
        """Ringkasan cepat pendapatan dan sesi hari ini (Dashboard Overview)."""
        hari_ini = now_local().date()
        total = TransaksiRepository.get_total_pendapatan_hari_ini(hari_ini)
        total_sesi = SesiRepository.count_by_date(hari_ini)
        aktif_sekarang = len(SesiRepository.get_all_aktif())

        return {
            "tanggal": str(hari_ini),
            "total_pendapatan": int(total),
            "total_sesi": total_sesi,
            "sesi_aktif": aktif_sekarang
        }

    @staticmethod
    def get_laporan_by_tanggal(tanggal_str=None, kasir_id=None, page=1, per_page=10, metode_pembayaran=None):
        """Laporan mendalam berdasarkan filter tanggal tertentu dengan pagination."""
        try:
            if tanggal_str:
                tanggal = datetime.strptime(tanggal_str, "%Y-%m-%d").date()
            else:
                tanggal = now_local().date()

            total_pendapatan_billing_gross = TransaksiRepository.get_total_pemasukan(tanggal, kasir_id, metode_pembayaran)
            total_refund = TransaksiRepository.get_total_refund(tanggal, kasir_id, metode_pembayaran)

            total_pendapatan_billing = total_pendapatan_billing_gross - total_refund
            total_pendapatan_menu = MenuRepository.get_total_pemasukan_by_date(tanggal, kasir_id, metode_pembayaran)
            total_pendapatan_gabungan = total_pendapatan_billing + total_pendapatan_menu

            if kasir_id:
                total_guest = SesiRepository.count_by_tanggal_tipe_kasir(tanggal, kasir_id, 'guest')
                total_member = SesiRepository.count_by_tanggal_tipe_kasir(tanggal, kasir_id, 'member')
            else:
                total_guest = SesiRepository.count_by_tanggal_dan_tipe(tanggal, 'guest')
                total_member = SesiRepository.count_by_tanggal_dan_tipe(tanggal, 'member')

            pagination = TransaksiRepository.get_history_nota_paginated(tanggal, page, per_page, kasir_id, metode_pembayaran)
            history_struk = pagination.items

            return {
                "status": "success",
                "tanggal": tanggal.isoformat(),
                "page": pagination.page,
                "pages": pagination.pages,
                "total": pagination.total,
                "has_next": pagination.has_next,
                "has_prev": pagination.has_prev,
                "total_pendapatan": total_pendapatan_gabungan,
                "total_pendapatan_billing": total_pendapatan_billing,
                "total_pendapatan_billing_gross": total_pendapatan_billing_gross,
                "total_pendapatan_menu": total_pendapatan_menu,
                "total_refund": total_refund,
                "total_sesi": total_guest + total_member,
                "total_guest": total_guest,
                "total_member": total_member,
                "pendapatan_guest": ReportService.get_pendapatan_kategori(tanggal, 'guest', kasir_id, metode_pembayaran),
                "pendapatan_member": ReportService.get_pendapatan_kategori(tanggal, 'member', kasir_id, metode_pembayaran),
                "sesi_aktif": len(SesiRepository.get_all_aktif()),
                "history_struk": ReportService._format_history_struk(history_struk)
            }
        except Exception as e:
            raise Exception(f"Gagal hitung laporan: {str(e)}")

    @staticmethod
    def get_laporan_kantin_by_tanggal(tanggal_str=None, kasir_id=None, page=1, per_page=12, metode_pembayaran=None):
        """Laporan khusus kantin berdasarkan filter tanggal dengan manual pagination untuk grouping per nota."""
        try:
            if tanggal_str:
                tanggal = datetime.strptime(tanggal_str, "%Y-%m-%d").date()
            else:
                tanggal = now_local().date()

            total_pendapatan_menu = MenuRepository.get_total_pemasukan_by_date(tanggal, kasir_id, metode_pembayaran)
            all_tm = MenuRepository.get_transactions_by_date(tanggal, kasir_id, metode_pembayaran)

            from collections import OrderedDict
            grouped = OrderedDict()
            for tm in all_tm:
                key = tm.no_nota or f"ID-{tm.id}"
                if key not in grouped:
                    grouped[key] = []
                grouped[key].append(tm)

            total_items = len(grouped)
            pages = (total_items + per_page - 1) // per_page if per_page > 0 else 1
            if page < 1:
                page = 1
            start_idx = (page - 1) * per_page
            end_idx = start_idx + per_page

            paginated_groups = list(grouped.values())[start_idx:end_idx]

            history_menu = []
            for nota_group in paginated_groups:
                first_item = nota_group[0]
                item_names = [f"{tm.menu.nama} x{tm.jumlah}" if tm.menu else f"Menu Terhapus x{tm.jumlah}" for tm in nota_group]
                total_qty = sum(tm.jumlah for tm in nota_group)
                total_harga = sum(tm.total_harga for tm in nota_group)

                history_menu.append({
                    "id": first_item.id,
                    "no_nota": first_item.no_nota,
                    "menu_nama": ", ".join(item_names),
                    "jumlah": total_qty,
                    "total_harga": total_harga,
                    "pc_kode": first_item.pc_kode or "-",
                    "waktu": format_display(first_item.tanggal) if first_item.tanggal else "-",
                    "kasir_nama": first_item.operator or (first_item.kasir.username if first_item.kasir else "System"),
                    "tunai": first_item.tunai,
                    "kembalian": first_item.kembalian,
                    "metode_pembayaran": first_item.metode_pembayaran or "Tunai",
                })

            return {
                "status": "success",
                "tanggal": tanggal.isoformat(),
                "page": page,
                "pages": pages,
                "total": total_items,
                "has_next": page < pages,
                "has_prev": page > 1,
                "total_pendapatan_menu": total_pendapatan_menu,
                "history_menu": history_menu
            }
        except Exception as e:
            raise Exception(f"Gagal hitung laporan kantin: {str(e)}")

    @staticmethod
    def get_tanggal_list():
        """Ambil daftar tanggal unik yang memiliki aktivitas (untuk filter dropdown)."""
        return SesiRepository.get_distinct_tanggal()

    @staticmethod
    def find_transaction(no_input):
        """Mencari transaksi berdasarkan nomor nota."""
        if not no_input:
            return None

        t = TransaksiRepository.get_by_no_nota(no_input)
        if t:
            return t

        if no_input.startswith("TRX"):
            try:
                kode = no_input[3:]
                sesi_id = int(kode[:-10])
                return TransaksiRepository.get_by_sesi_id(sesi_id)
            except (ValueError, IndexError):
                return None

        return None

    @staticmethod
    def get_struk_data(t_id, kasir_name="Kasir"):
        """Mengambil dan memetakan data transaksi ke format struk belanja."""
        t = TransaksiRepository.get_by_id(t_id)
        if not t:
            return None

        no_nota_final = t.no_nota if t.no_nota else f"OLD-{t.id}"

        nama_p = "Guest"
        if t.member:
            nama_p = t.member.nama_lengkap or t.member.username
        elif t.sesi and t.sesi.nama_guest:
            nama_p = t.sesi.nama_guest

        pc_display = t.sesi.pc.kode if (t.sesi and t.sesi.pc) else "-"

        if t.paket:
            qty = 1
            if t.menit and t.paket.durasi_menit and t.paket.durasi_menit > 0:
                qty = t.menit // t.paket.durasi_menit
            if qty > 1:
                ket_rincian = f"Paket {t.paket.nama} {qty}x"
            else:
                ket_rincian = f"Paket {t.paket.nama}"
        else:
            ket_rincian = t.keterangan or "Transaksi Warnet"

        nama_kasir = "Kasir"
        if t.user:
            nama_kasir = t.user.nama_lengkap or t.user.username
        else:
            nama_kasir = kasir_name

        warnet_title = SettingsRepository.get("warnet_title") or "TMBilling"
        warnet_address = SettingsRepository.get("warnet_address") or "Jl. Merdeka No. 123, Kota"
        warnet_phone = SettingsRepository.get("warnet_phone") or "0812-3456-7890"
        warnet_footer = SettingsRepository.get("warnet_footer") or "Terima kasih, selamat bermain!"

        return {
            "no_nota": no_nota_final,
            "tanggal": format_display(t.dibuat_pada),
            "pc_kode": pc_display,
            "tipe": t.sesi.tipe if t.sesi else "topup",
            "nama_pelanggan": nama_p,
            "rincian": [{"keterangan": ket_rincian, "durasi": t.menit or 0, "harga": t.jumlah}],
            "total_durasi": t.menit or 0,
            "total_harga": t.jumlah,
            "kasir": nama_kasir,
            "payment_method": getattr(t, 'metode_pembayaran', 'Tunai') or 'Tunai',
            "warnet_title": warnet_title,
            "warnet_address": warnet_address,
            "warnet_phone": warnet_phone,
            "warnet_footer": warnet_footer,
        }

    @staticmethod
    def get_struk_menu_data(t_menu_id, kasir_name="Kasir"):
        """Mengambil dan memetakan data transaksi menu ke format struk belanja."""
        tm_first = MenuRepository.get_transaksi_by_id(t_menu_id)
        if not tm_first:
            return None

        nama_kasir = "Kasir"
        if tm_first.kasir:
            nama_kasir = tm_first.kasir.nama_lengkap or tm_first.kasir.username
        else:
            nama_kasir = kasir_name

        warnet_title = SettingsRepository.get("warnet_title") or "TMBilling"
        warnet_address = SettingsRepository.get("warnet_address") or "Jl. Merdeka No. 123, Kota"
        warnet_phone = SettingsRepository.get("warnet_phone") or "0812-3456-7890"
        warnet_footer = SettingsRepository.get("warnet_footer") or "Terima kasih atas kunjungan Anda!"

        if tm_first.no_nota:
            from app.models.menu.menu import TransaksiMenu
            semua_tm = TransaksiMenu.query.filter_by(no_nota=tm_first.no_nota).all()
        else:
            semua_tm = [tm_first]

        rincian = []
        total_harga = 0
        total_qty = 0
        for tm in semua_tm:
            rincian.append({"keterangan": tm.menu.nama if tm.menu else "Menu Terhapus", "durasi": tm.jumlah, "harga": tm.total_harga})
            total_harga += tm.total_harga
            total_qty += tm.jumlah

        return {
            "no_nota": tm_first.no_nota or f"ID-{tm_first.id}",
            "tanggal": format_display(tm_first.tanggal) if tm_first.tanggal else "",
            "pc_kode": tm_first.pc_kode or "-",
            "tipe": "kantin",
            "nama_pelanggan": "Pelanggan POS",
            "rincian": rincian,
            "total_durasi": total_qty,
            "total_harga": total_harga,
            "kasir": nama_kasir,
            "payment_method": tm_first.metode_pembayaran or 'Tunai',
            "tunai": tm_first.tunai,
            "kembalian": tm_first.kembalian,
            "warnet_title": warnet_title,
            "warnet_address": warnet_address,
            "warnet_phone": warnet_phone,
            "warnet_footer": warnet_footer,
        }

    @staticmethod
    def get_kasir_list(kasir_id, kasir_role):
        """Ambil daftar kasir sesuai role, termasuk remote operator terdaftar."""
        if kasir_role == 'admin':
            users = UserRepository.get_all_active()
            result = [{"id": str(u.id), "nama": f"{u.nama_lengkap or u.username} (Lokal)"} for u in users if u]

            # Ambil remote operators yang ada di riwayat Transaksi & TransaksiMenu
            remote_ops = set()
            for op in TransaksiRepository.get_distinct_remote_operators():
                if op:
                    remote_ops.add(op)
            for op in MenuRepository.get_distinct_remote_operators():
                if op:
                    remote_ops.add(op)

            # Tambahkan juga cabang aktif dari database Branch
            try:
                from app.models.branch import Branch
                branches = Branch.query.filter_by(aktif=True).all()
                for b in branches:
                    if b.nama:
                        remote_ops.add(f"admin (Remote: {b.nama})")
            except Exception:
                pass

            hidden_ops = set()
            try:
                from app.services.branch.branch_service import BranchService
                hidden_ops = BranchService.get_hidden_operators()
            except Exception:
                pass

            for op in sorted(remote_ops):
                if op not in hidden_ops:
                    result.append({"id": f"operator:{op}", "nama": op})
            return result
        else:
            user = UserRepository.get_by_id(kasir_id)
            users = [user] if user else []
            return [{"id": str(u.id), "nama": u.nama_lengkap or u.username} for u in users if u]

    @staticmethod
    def get_pendapatan_kategori(tanggal, kategori, kasir_id=None, metode_pembayaran=None):
        """Menhitung pendapatan per kategori."""
        if kategori == 'guest':
            jenis = ["beli_paket_guest", "tambah_waktu_guest"]
        else:
            jenis = ["beli_paket_member", "tambah_waktu_sesi"]

        return TransaksiRepository.get_total_pendapatan_by_tanggal(tanggal, jenis, kasir_id, metode_pembayaran)

    @staticmethod
    def get_total_menit_harian(tanggal):
        """Menghitung total menit terpakai."""
        sesi_list = SesiRepository.get_selesai_by_tanggal(tanggal)
        return sum(s.menit_terpakai() for s in sesi_list)

    @staticmethod
    def _format_history_struk(transaksi_list):
        """Format data transaksi menjadi baris tabel struk."""
        formatted = []
        for t in transaksi_list:
            nama = "Guest"
            if t.member:
                nama = t.member.nama_lengkap or t.member.username
            elif t.sesi and t.sesi.nama_guest:
                nama = t.sesi.nama_guest

            pc_kode = t.sesi.pc.kode if t.sesi and t.sesi.pc else "-"

            formatted.append({
                "id": t.id,
                "pc_kode": pc_kode,
                "no_nota": t.no_nota or f"TRX-{t.id}",
                "nama_pelanggan": nama,
                "jumlah": t.jumlah,
                "waktu": format_display(t.dibuat_pada),
                "keterangan": t.keterangan,
                "jenis": t.jenis or "",
                "kasir_nama": t.operator or (t.user.nama_lengkap or t.user.username if t.user else "Kasir"),
                "metode_pembayaran": t.metode_pembayaran or "Tunai"
            })
        return formatted

    # =========================================================================
    # DELEGATED METHODS FOR BACKWARD COMPATIBILITY
    # =========================================================================

    @staticmethod
    def get_system_logs(limit=500, filter_text="", kategori=""):
        return LogAuditService.get_system_logs(limit, filter_text, kategori)

    @staticmethod
    def clear_system_logs(operator="system"):
        return LogAuditService.clear_system_logs(operator)

    @staticmethod
    def clear_all_transactions(operator="system"):
        return LogAuditService.clear_all_transactions(operator)

    @staticmethod
    def delete_transaction(t_id, operator="system"):
        return LogAuditService.delete_transaction(t_id, operator)

    @staticmethod
    def clear_transactions_by_date(tanggal, operator="system"):
        return LogAuditService.clear_transactions_by_date(tanggal, operator)

    @staticmethod
    def prepare_export_data(filter_text=""):
        return LogAuditService.prepare_export_data(filter_text)

    @staticmethod
    def export_billing_pdf(tanggal_str=None, kasir_id=None, metode_pembayaran=None):
        data = ReportService.get_laporan_by_tanggal(tanggal_str, kasir_id, page=1, per_page=100000, metode_pembayaran=metode_pembayaran)
        data["kasir_id"] = kasir_id
        return PdfExportService.export_billing_pdf(data)

    @staticmethod
    def export_pnl_pdf(tanggal_str=None):
        data = ReportService.get_laporan_by_tanggal(tanggal_str, kasir_id=None, page=1, per_page=100000)
        return PdfExportService.export_pnl_pdf(data)

    @staticmethod
    def export_kantin_pdf(tanggal_str=None, kasir_id=None, metode_pembayaran=None):
        data = ReportService.get_laporan_kantin_by_tanggal(tanggal_str, kasir_id, page=1, per_page=100000, metode_pembayaran=metode_pembayaran)
        return PdfExportService.export_kantin_pdf(data, kasir_id)

    @staticmethod
    def export_audit_pdf(filter_text=""):
        data = LogAuditService.get_system_logs(limit=10000, filter_text=filter_text)
        return PdfExportService.export_audit_pdf(data.get("logs", []), filter_text)