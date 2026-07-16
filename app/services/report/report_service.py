# app/services/report_service.py

"""Service untuk laporan dan audit.

Modul ini menangani agregasi data laporan keuangan dan
management system logs.
"""

from app.models import db, now_local
from app.repositories import TransaksiRepository
from app.repositories import SesiRepository
from app.repositories import SettingsRepository
from app.utils.logger import read_logs, write_log, clear_logs
from app.utils.timezone_utils import format_display
from datetime import datetime


class ReportService:
    """Service untuk business logic laporan."""

    # =========================================================================
    # 1. LAPORAN KEUANGAN & OPERASIONAL (FINANCIAL)
    # =========================================================================
    # Fokus: Menghitung pendapatan, total sesi, dan histori struk per tanggal.

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
        """Laporan mendalam berdasarkan filter tanggal tertentu (dan opsional kasir_id) dengan pagination."""
        try:
            if tanggal_str:
                tanggal = datetime.strptime(tanggal_str, "%Y-%m-%d").date()
            else:
                tanggal = now_local().date()

            # 1. Ambil angka dasar pendapatan & refund (Filter Kasir)
            total_pendapatan_billing = TransaksiRepository.get_total_pemasukan(tanggal, kasir_id, metode_pembayaran)
            total_refund = TransaksiRepository.get_total_refund(tanggal, kasir_id, metode_pembayaran)
            
            # Ambil pendapatan F&B
            from app.repositories import MenuRepository
            total_pendapatan_menu = MenuRepository.get_total_pemasukan_by_date(tanggal, kasir_id, metode_pembayaran)
            total_pendapatan_gabungan = total_pendapatan_billing + total_pendapatan_menu

            # 2. Ambil statistik kuantitas sesi per tipe
            # Jika difilter per kasir, hanya hitung sesi yang punya Transaksi dari kasir tsb
            if kasir_id:
                total_guest = SesiRepository.count_by_tanggal_tipe_kasir(tanggal, kasir_id, 'guest')
                total_member = SesiRepository.count_by_tanggal_tipe_kasir(tanggal, kasir_id, 'member')
            else:
                total_guest = SesiRepository.count_by_tanggal_dan_tipe(tanggal, 'guest')
                total_member = SesiRepository.count_by_tanggal_dan_tipe(tanggal, 'member')

            # History transaksi difilter berdasarkan kasir_id dengan pagination
            pagination = TransaksiRepository.get_history_nota_paginated(tanggal, page, per_page, kasir_id, metode_pembayaran)
            history_struk = pagination.items

            return {
                "status": "success",
                "tanggal": tanggal.isoformat(),
                # Pagination Info
                "page": pagination.page,
                "pages": pagination.pages,
                "total": pagination.total,
                "has_next": pagination.has_next,
                "has_prev": pagination.has_prev,
                # Data Card Atas
                "total_pendapatan": total_pendapatan_gabungan,
                "total_pendapatan_billing": total_pendapatan_billing,
                "total_pendapatan_menu": total_pendapatan_menu,
                "total_refund": total_refund,
                "total_sesi": total_guest + total_member, # Global sesi count
                # Statistik Per Tipe
                "total_guest": total_guest,
                "total_member": total_member,
                # Pendapatan Per Tipe (Logic Mapping Baru)
                "pendapatan_guest": ReportService.get_pendapatan_kategori(tanggal, 'guest', kasir_id, metode_pembayaran),
                "pendapatan_member": ReportService.get_pendapatan_kategori(tanggal, 'member', kasir_id, metode_pembayaran),
                # Footer & Histori
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

            from app.repositories import MenuRepository
            
            # Ambil total pendapatan F&B untuk tanggal tersebut
            total_pendapatan_menu = MenuRepository.get_total_pemasukan_by_date(tanggal, kasir_id, metode_pembayaran)

            # 1. Fetch semua transaksi untuk tanggal tersebut
            all_tm = MenuRepository.get_transactions_by_date(tanggal, kasir_id, metode_pembayaran)
            
            # 2. Group by no_nota manually di memory
            from collections import OrderedDict
            grouped = OrderedDict()
            for tm in all_tm:
                key = tm.no_nota or f"ID-{tm.id}"
                if key not in grouped:
                    grouped[key] = []
                grouped[key].append(tm)
                
            # 3. Manual Pagination
            total_items = len(grouped)
            pages = (total_items + per_page - 1) // per_page if per_page > 0 else 1
            if page < 1: page = 1
            start_idx = (page - 1) * per_page
            end_idx = start_idx + per_page
            
            paginated_groups = list(grouped.values())[start_idx:end_idx]

            history_menu = []
            for nota_group in paginated_groups:
                first_item = nota_group[0]
                # Menggabungkan nama menu dengan rincian quantity
                item_names = [f"{tm.menu.nama} x{tm.jumlah}" if tm.menu else f"Menu Terhapus x{tm.jumlah}" for tm in nota_group]
                total_qty = sum(tm.jumlah for tm in nota_group)
                total_harga = sum(tm.total_harga for tm in nota_group)
                
                history_menu.append({
                    "id": first_item.id, # ID transaksi pertama (untuk patokan cetak struk)
                    "no_nota": first_item.no_nota,
                    "menu_nama": ", ".join(item_names),
                    "jumlah": total_qty,
                    "total_harga": total_harga,
                    "pc_kode": first_item.pc_kode or "-",
                    "waktu": format_display(first_item.tanggal) if first_item.tanggal else "-",
                    "kasir_nama": first_item.kasir.username if first_item.kasir else "System",
                    "tunai": first_item.tunai,
                    "kembalian": first_item.kembalian,
                    "metode_pembayaran": first_item.metode_pembayaran or "Tunai",
                })

            return {
                "status": "success",
                "tanggal": tanggal.isoformat(),
                # Pagination Info
                "page": page,
                "pages": pages,
                "total": total_items,
                "has_next": page < pages,
                "has_prev": page > 1,
                # Data Kantin
                "total_pendapatan_menu": total_pendapatan_menu,
                "history_menu": history_menu
            }
        except Exception as e:
            raise Exception(f"Gagal hitung laporan kantin: {str(e)}")

    @staticmethod
    def get_tanggal_list():
        """Ambil daftar tanggal unik yang memiliki aktivitas (untuk filter dropdown)."""
        # SesiRepository.get_distinct_tanggal() sudah menggabungkan sesi & transaksi
        return SesiRepository.get_distinct_tanggal()

    @staticmethod
    def find_transaction(no_input):
        """Mencari transaksi berdasarkan nomor nota (format baru maupun lama)."""
        if not no_input:
            return None

        # 1. Cari di format baru (TM-...)
        t = TransaksiRepository.get_by_no_nota(no_input)
        if t:
            return t

        # 2. Support pencarian format TRX lama (TRX-ID-TIMESTAMP)
        if no_input.startswith("TRX"):
            try:
                kode = no_input[3:]
                # Mengambil ID Sesi dari format TRX lama
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

        # Mapping data untuk tampilan struk
        no_nota_final = t.no_nota if t.no_nota else f"OLD-{t.id}"
        
        # Penentuan nama pelanggan
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

        # Penentuan nama kasir (prioritas nama lengkap)
        nama_kasir = "Kasir"
        if t.user:
            nama_kasir = t.user.nama_lengkap or t.user.username
        else:
            nama_kasir = kasir_name

        # Ambil pengaturan dinamis nota (nama, alamat, telepon, footer)
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
        """Mengambil dan memetakan data transaksi menu ke format struk belanja (Mendukung grouping per nota)."""
        from app.repositories import MenuRepository
        from app.models.menu.menu import TransaksiMenu
        tm_first = MenuRepository.get_transaksi_by_id(t_menu_id)
        if not tm_first:
            return None

        # Penentuan nama kasir (prioritas nama lengkap)
        nama_kasir = "Kasir"
        if tm_first.kasir:
            nama_kasir = tm_first.kasir.nama_lengkap or tm_first.kasir.username
        else:
            nama_kasir = kasir_name

        # Ambil pengaturan dinamis nota (nama, alamat, telepon, footer)
        warnet_title = SettingsRepository.get("warnet_title") or "TMBilling"
        warnet_address = SettingsRepository.get("warnet_address") or "Jl. Merdeka No. 123, Kota"
        warnet_phone = SettingsRepository.get("warnet_phone") or "0812-3456-7890"
        warnet_footer = SettingsRepository.get("warnet_footer") or "Terima kasih atas kunjungan Anda!"

        # Fetch semua transaksi dengan no_nota yang sama
        if tm_first.no_nota:
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
        """Ambil daftar kasir sesuai role."""
        from app.repositories import UserRepository
        if kasir_role == 'admin':
            # Admin bisa lihat semua kasir
            users = UserRepository.get_all_active()
        else:
            # Kasir hanya bisa lihat dirinya sendiri
            user = UserRepository.get_by_id(kasir_id)
            users = [user] if user else []
        
        return [{"id": u.id, "nama": u.nama_lengkap or u.username} for u in users if u]


    # =========================================================================
    # 2. SYSTEM LOGS & AUDIT TRAIL (LOGGING)
    # =========================================================================
    # Fokus: Manajemen file log untuk memantau aktivitas sistem dan kecurangan.

    @staticmethod
    def get_system_logs(limit=500, filter_text="", kategori=""):
        """Ambil isi log sistem untuk ditampilkan di dashboard kasir, parse jadi JSON."""
        # Ambil raw logs, jangan dilimit dulu agar filter kategori akurat
        # Jika limit terlalu kecil, log kategori tertentu mungkin tidak terbawa dari awal.
        # Atau fetch semua (read_logs tanpa limit bisa lambat jika file terlalu besar,
        # tapi kita pakai limit besar misalkan 2000 untuk raw fetch, lalu filter).
        raw_logs = read_logs(5000, filter_text if filter_text else None)
        
        import re
        import json
        pattern = re.compile(r"^\[(.*?)\] \[(.*?)\] (.*?) - (.*)$")
        
        parsed_logs = []
        for line in raw_logs:
            if line.startswith("{") and line.endswith("}"):
                try:
                    data = json.loads(line)
                    timestamp = data.get("timestamp", "")
                    user = data.get("user", "")
                    action = data.get("action", "")
                    detail = data.get("detail", "")
                    ip_address = data.get("ip_address", "-")
                    browser_agent = data.get("browser_agent", "-")
                    detail_json = data.get("detail_json", None)
                except Exception:
                    timestamp, user, action, detail = "", "", "", line
                    ip_address, browser_agent, detail_json = "-", "-", None
            else:
                match = pattern.match(line)
                if match:
                    timestamp, user, action, detail = match.groups()
                    ip_address, browser_agent, detail_json = "-", "-", None
                else:
                    timestamp, user, action, detail = "", "", "", line
                    ip_address, browser_agent, detail_json = "-", "-", None
                
            # Pengelompokan Kategori Berdasarkan Aksi
            category = "sistem"
            action_upper = action.upper()
            
            if any(k in action_upper for k in ["TRANSAKSI", "STRUK", "REFUND", "CLEAR_TANGGAL"]):
                category = "transaksi"
            elif any(k in action_upper for k in ["SESI", "TAMBAH_WAKTU", "PINDAH_PC", "BUKA_GUEST", "BUKA_MEMBER"]):
                category = "sesi"
            elif "BLACKOUT" in action_upper:
                category = "blackout"
                
            # Jika filter kategori aktif, skip yang tidak cocok
            if kategori and kategori != "Semua":
                kategori_lower = kategori.lower() # "sistem", "transaksi", "sesi", "blackout"
                if kategori_lower != category:
                    continue
                    
            if timestamp:
                parsed_logs.append({
                    "timestamp": timestamp,
                    "user": user,
                    "action": action,
                    "detail": detail,
                    "category": category,
                    "ip_address": ip_address,
                    "browser_agent": browser_agent,
                    "detail_json": detail_json,
                    "raw": line
                })
            else:
                if not kategori or kategori == "Semua":
                    parsed_logs.append({
                        "raw": line,
                        "category": "unknown",
                        "timestamp": "",
                        "user": "",
                        "action": "",
                        "detail": "",
                        "ip_address": "-",
                        "browser_agent": "-",
                        "detail_json": None
                    })
            
            if len(parsed_logs) >= limit:
                break
                
        return {"logs": parsed_logs, "total": len(parsed_logs)}

    @staticmethod
    def clear_system_logs(operator="system"):
        """Bersihkan file log (Maintenance)."""
        if clear_logs():
            write_log("CLEAR_LOG", "Log dibersihkan", user=operator)
            return True
        return False
        
    @staticmethod
    def clear_all_transactions(operator="system"):
        """Menghapus seluruh riwayat transaksi & sesi (Maintenance)."""
        try:
            count_t = TransaksiRepository.delete_all()
            count_s = SesiRepository.delete_history()
            db.session.commit()
            write_log("CLEAR_ALL_HISTORY", f"Seluruh riwayat dikosongkan ({count_t} transaksi, {count_s} sesi)", user=operator)
            return True
        except Exception as e:
            write_log("ERROR", f"Gagal hapus seluruh riwayat: {str(e)}", user=operator)
            return False

    @staticmethod
    def delete_transaction(t_id, operator="system"):
        """Menghapus satu transaksi (Audit)."""
        try:
            t = TransaksiRepository.get_by_id(t_id)
            if not t:
                return False
            
            nota = t.no_nota or f"ID:{t_id}"
            
            t_detail = {
                "no_nota": t.no_nota,
                "total": t.jumlah if hasattr(t, 'jumlah') else 0,
                "tipe_pembayaran": t.tipe_pembayaran if hasattr(t, 'tipe_pembayaran') else "-",
                "jenis": t.jenis if hasattr(t, 'jenis') else "-",
                "pelanggan": t.member.username if t.member else (t.sesi.nama_guest if hasattr(t, 'sesi') and t.sesi else "Guest")
            }
            
            if TransaksiRepository.delete_by_id(t_id):
                db.session.commit()
                write_log("DELETE_STRUK", f"Struk {nota} dihapus permanen", user=operator, detail_json=t_detail)
                return True
            return False
        except Exception as e:
            write_log("ERROR", f"Gagal hapus struk {t_id}: {str(e)}", user=operator)
            return False

    @staticmethod
    def clear_transactions_by_date(tanggal, operator="system"):
        """Menghapus riwayat transaksi & sesi pada tanggal tertentu (Audit)."""
        try:
            count_t = TransaksiRepository.delete_by_date(tanggal)
            count_s = SesiRepository.delete_history_by_date(tanggal)
            db.session.commit()
            write_log("CLEAR_TANGGAL", f"Riwayat tanggal {tanggal} dihapus ({count_t} transaksi, {count_s} sesi)", user=operator)
            return True
        except Exception as e:
            write_log("ERROR", f"Gagal hapus riwayat tanggal {tanggal}: {str(e)}", user=operator)
            return False

    @staticmethod
    def prepare_export_data(filter_text=""):
        """Siapkan data log untuk di-export ke file eksternal."""
        logs = read_logs(5000, filter_text if filter_text else None)
        content = "\n".join(logs)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        return content, timestamp




    # =========================================================================
    # 3. HELPER METHODS (INTERNAL ONLY)
    # =========================================================================
    # Fokus: Fungsi pembantu untuk memproses data mentah sebelum dikirim ke UI.

    @staticmethod
    def get_pendapatan_kategori(tanggal, kategori, kasir_id=None, metode_pembayaran=None):
        """Menghitung pendapatan per kategori (Logic Mapping yang dipindah dari Repo)."""
        if kategori == 'guest':
            jenis = ["beli_paket_guest", "tambah_waktu_guest"]
        else:
            jenis = ["beli_paket_member", "tambah_waktu_sesi"]
        
        return TransaksiRepository.get_total_pendapatan_by_tanggal(tanggal, jenis, kasir_id, metode_pembayaran)

    @staticmethod
    def get_total_menit_harian(tanggal):
        """Menghitung total menit terpakai (Logic Calculation yang dipindah dari Repo)."""
        sesi_list = SesiRepository.get_selesai_by_tanggal(tanggal)
        return sum(s.menit_terpakai() for s in sesi_list)

    @staticmethod
    def _format_history_struk(transaksi_list):
        """Format data transaksi menjadi baris tabel struk yang siap cetak."""
        formatted = []
        for t in transaksi_list:
            # Logic Penentuan Nama Pelanggan
            nama = "Guest"
            if t.member:
                nama = t.member.nama_lengkap or t.member.username
            elif t.sesi and t.sesi.nama_guest:
                nama = t.sesi.nama_guest
            
            # Logic Kode PC (Jika Top-up saldo member tanpa sesi aktif, tampilkan '-')
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
                "metode_pembayaran": t.metode_pembayaran or "Tunai"
            })
        return formatted

    @staticmethod
    def export_billing_pdf(tanggal_str=None, kasir_id=None, metode_pembayaran=None):
        """Mengekspor laporan billing harian ke PDF."""
        import io
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
        from reportlab.lib.units import cm

        # Ambil data semua (tanpa pagination)
        data = ReportService.get_laporan_by_tanggal(tanggal_str, kasir_id, page=1, per_page=100000, metode_pembayaran=metode_pembayaran)
        tanggal = data["tanggal"]

        warnet_title = SettingsRepository.get("warnet_title") or "TMBilling"
        warnet_address = SettingsRepository.get("warnet_address") or "Jl. Merdeka No. 123, Kota"
        warnet_phone = SettingsRepository.get("warnet_phone") or "0812-3456-7890"

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=1.0*cm,
            leftMargin=1.0*cm,
            topMargin=1.2*cm,
            bottomMargin=1.2*cm
        )

        styles = getSampleStyleSheet()
        
        style_title = ParagraphStyle(
            name="TitleStyle",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            textColor=colors.HexColor("#1F2937"),
            alignment=1, # Center
            spaceAfter=6
        )
        style_subtitle = ParagraphStyle(
            name="SubTitleStyle",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10,
            textColor=colors.HexColor("#4B5563"),
            alignment=1, # Center
            spaceAfter=15
        )
        style_section = ParagraphStyle(
            name="SectionStyle",
            parent=styles["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=12,
            textColor=colors.HexColor("#1F2937"),
            spaceBefore=10,
            spaceAfter=6
        )
        style_meta = ParagraphStyle(
            name="MetaStyle",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10,
            textColor=colors.HexColor("#1F2937")
        )
        style_table_header = ParagraphStyle(
            name="TableHeaderStyle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            textColor=colors.white,
            alignment=1 # Center
        )
        style_table_cell = ParagraphStyle(
            name="TableCellStyle",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8,
            textColor=colors.HexColor("#374151")
        )
        style_table_cell_center = ParagraphStyle(
            name="TableCellCenterStyle",
            parent=style_table_cell,
            alignment=1 # Center
        )
        style_table_cell_right = ParagraphStyle(
            name="TableCellRightStyle",
            parent=style_table_cell,
            alignment=2 # Right
        )
        style_total = ParagraphStyle(
            name="TotalStyle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            textColor=colors.HexColor("#1F2937"),
            alignment=2 # Right
        )

        story = []

        # Warnet Header (Kop Laporan)
        story.append(Paragraph(warnet_title, style_title))
        story.append(Paragraph(f"{warnet_address} | Telp: {warnet_phone}", style_subtitle))
        story.append(Spacer(1, 0.4*cm))

        # Judul Laporan
        story.append(Paragraph("LAPORAN OMZET BILLING", style_section))
        story.append(Spacer(1, 0.2*cm))

        # Meta info kasir & date
        nama_kasir = "Semua Kasir"
        if kasir_id:
            from app.repositories import UserRepository
            u = UserRepository.get_by_id(kasir_id)
            if u:
                nama_kasir = u.nama_lengkap or u.username

        meta_data = [
            [Paragraph(f"<b>Tanggal Laporan:</b> {tanggal}", style_meta), Paragraph(f"<b>Kasir:</b> {nama_kasir}", style_meta)],
            [Paragraph(f"<b>Waktu Cetak:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", style_meta), Paragraph("", style_meta)]
        ]
        meta_table = Table(meta_data, colWidths=[9.5*cm, 9.5*cm])
        meta_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 0.5*cm))

        history_struk = data.get("history_struk", [])
        
        headers = [
            Paragraph("No", style_table_header),
            Paragraph("Waktu", style_table_header),
            Paragraph("No. Nota", style_table_header),
            Paragraph("Pelanggan", style_table_header),
            Paragraph("PC", style_table_header),
            Paragraph("Keterangan", style_table_header),
            Paragraph("Metode", style_table_header),
            Paragraph("Jumlah", style_table_header)
        ]
        
        table_data = [headers]
        
        for idx, t in enumerate(history_struk, 1):
            waktu = t.get("waktu", "-")
            no_nota = t.get("no_nota", "-")
            nama_p = t.get("nama_pelanggan", "-")
            pc = t.get("pc_kode", "-")
            ket = t.get("keterangan", "-")
            metode = t.get("metode_pembayaran", "Tunai") or "Tunai"
            jumlah_raw = t.get("jumlah", 0)
            jumlah = f"Rp {jumlah_raw:,.0f}"
            
            row = [
                Paragraph(str(idx), style_table_cell_center),
                Paragraph(waktu, style_table_cell_center),
                Paragraph(no_nota, style_table_cell_center),
                Paragraph(nama_p, style_table_cell),
                Paragraph(pc, style_table_cell_center),
                Paragraph(ket, style_table_cell),
                Paragraph(metode, style_table_cell_center),
                Paragraph(jumlah, style_table_cell_right)
            ]
            table_data.append(row)

        col_widths = [0.8*cm, 2.5*cm, 2.3*cm, 3.2*cm, 1.0*cm, 4.5*cm, 2.2*cm, 2.5*cm]
        data_table = Table(table_data, colWidths=col_widths, repeatRows=1)
        
        # Style table
        t_style = TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#374151")),
            ('ALIGN', (0,0), (-1,0), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#D1D5DB")),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ])
        
        for i in range(1, len(table_data)):
            if i % 2 == 0:
                t_style.add('BACKGROUND', (0, i), (-1, i), colors.HexColor("#F9FAFB"))
                
        data_table.setStyle(t_style)
        story.append(data_table)
        story.append(Spacer(1, 0.4*cm))

        # Total Section
        total_omzet_raw = data.get("total_pendapatan_billing", 0)
        total_omzet = f"Rp {total_omzet_raw:,.0f}"
        
        total_data = [
            ["", "", Paragraph("<b>TOTAL OMZET BILLING:</b>", style_total), Paragraph(total_omzet, style_total)]
        ]
        total_col_widths = [1.0*cm, 9.7*cm, 5.5*cm, 2.8*cm]
        total_table = Table(total_data, colWidths=total_col_widths)
        total_table.setStyle(TableStyle([
            ('ALIGN', (2,0), (-1,-1), 'RIGHT'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 8),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ('GRID', (2,0), (3,0), 1, colors.HexColor("#1F2937")),
            ('BACKGROUND', (2,0), (3,0), colors.HexColor("#F3F4F6")),
        ]))
        story.append(total_table)

        doc.build(story)
        pdf_bytes = buffer.getvalue()
        
        filename = f"Laporan_Billing_{tanggal}_{nama_kasir.replace(' ', '_')}.pdf"
        return pdf_bytes, filename

    @staticmethod
    def export_pnl_pdf(tanggal_str=None):
        """Mengekspor laporan Laba Rugi (P&L) harian ke PDF."""
        import io
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
        from reportlab.lib.units import cm

        # Ambil data semua (tanpa pagination)
        data = ReportService.get_laporan_by_tanggal(tanggal_str, kasir_id=None, page=1, per_page=100000)
        tanggal = data["tanggal"]

        warnet_title = SettingsRepository.get("warnet_title") or "TMBilling"
        warnet_address = SettingsRepository.get("warnet_address") or "Jl. Merdeka No. 123, Kota"
        warnet_phone = SettingsRepository.get("warnet_phone") or "0812-3456-7890"

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=2.0*cm,
            leftMargin=2.0*cm,
            topMargin=1.5*cm,
            bottomMargin=1.5*cm
        )

        styles = getSampleStyleSheet()
        
        style_title = ParagraphStyle(
            name="TitleStyle",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            textColor=colors.HexColor("#1F2937"),
            alignment=1, # Center
            spaceAfter=6
        )
        style_subtitle = ParagraphStyle(
            name="SubTitleStyle",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10,
            textColor=colors.HexColor("#4B5563"),
            alignment=1, # Center
            spaceAfter=15
        )
        style_section = ParagraphStyle(
            name="SectionStyle",
            parent=styles["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=12,
            textColor=colors.HexColor("#1F2937"),
            spaceBefore=10,
            spaceAfter=6
        )
        style_meta = ParagraphStyle(
            name="MetaStyle",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10,
            textColor=colors.HexColor("#1F2937")
        )
        style_table_header = ParagraphStyle(
            name="TableHeaderStyle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10,
            textColor=colors.white,
            alignment=1 # Center
        )
        style_table_cell = ParagraphStyle(
            name="TableCellStyle",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10,
            textColor=colors.HexColor("#374151")
        )
        style_table_cell_bold = ParagraphStyle(
            name="TableCellBoldStyle",
            parent=style_table_cell,
            fontName="Helvetica-Bold"
        )
        style_table_cell_right = ParagraphStyle(
            name="TableCellRightStyle",
            parent=style_table_cell,
            alignment=2 # Right
        )
        style_table_cell_right_bold = ParagraphStyle(
            name="TableCellRightBoldStyle",
            parent=style_table_cell_bold,
            alignment=2 # Right
        )
        style_table_cell_profit = ParagraphStyle(
            name="TableCellProfitStyle",
            parent=style_table_cell_bold,
            textColor=colors.HexColor("#047857")
        )
        style_table_cell_profit_right = ParagraphStyle(
            name="TableCellProfitRightStyle",
            parent=style_table_cell_profit,
            alignment=2 # Right
        )

        story = []

        # Header
        story.append(Paragraph(warnet_title, style_title))
        story.append(Paragraph(f"{warnet_address} | Telp: {warnet_phone}", style_subtitle))
        story.append(Spacer(1, 0.5*cm))

        # Judul
        story.append(Paragraph("LAPORAN LABA RUGI (PROFIT & LOSS)", style_section))
        story.append(Spacer(1, 0.2*cm))

        meta_data = [
            [Paragraph(f"<b>Tanggal Laporan:</b> {tanggal}", style_meta)],
            [Paragraph(f"<b>Waktu Cetak:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", style_meta)]
        ]
        meta_table = Table(meta_data, colWidths=[17.0*cm])
        meta_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 0.6*cm))

        billing_rev = int(data.get("total_pendapatan_billing", 0))
        canteen_rev = int(data.get("total_pendapatan_menu", 0))
        total_rev = billing_rev + canteen_rev
        refund_val = int(data.get("total_refund", 0))
        net_profit = total_rev - refund_val

        # Construct Table Data
        table_data = [
            # Header
            [Paragraph("Deskripsi", style_table_header), Paragraph("Rincian", style_table_header), Paragraph("Total", style_table_header)],
            # Section 1
            [Paragraph("<b>1. PENDAPATAN (INFLOW)</b>", style_table_cell_bold), "", ""],
            [Paragraph("   Pendapatan Billing", style_table_cell), Paragraph(f"Rp {billing_rev:,.0f}", style_table_cell_right), ""],
            [Paragraph("   Pendapatan Kantin / F&B", style_table_cell), Paragraph(f"Rp {canteen_rev:,.0f}", style_table_cell_right), ""],
            [Paragraph("<b>Total Pendapatan</b>", style_table_cell_bold), "", Paragraph(f"Rp {total_rev:,.0f}", style_table_cell_right_bold)],
            # Section 2
            [Paragraph("<b>2. PENGURANG / REFUND (OUTFLOW)</b>", style_table_cell_bold), "", ""],
            [Paragraph("   Total Refund / Pembatalan Sesi", style_table_cell), Paragraph(f"Rp {refund_val:,.0f}", style_table_cell_right), ""],
            [Paragraph("<b>Total Pengurangan</b>", style_table_cell_bold), "", Paragraph(f"Rp {refund_val:,.0f}", style_table_cell_right_bold)],
            # Section 3
            [Paragraph("<b>LABA / RUGI BERSIH (NET PROFIT)</b>", style_table_cell_profit), "", Paragraph(f"Rp {net_profit:,.0f}", style_table_cell_profit_right)]
        ]

        col_widths = [9.0*cm, 4.0*cm, 4.0*cm]
        pnl_table = Table(table_data, colWidths=col_widths)
        
        # Styling Table Rows
        t_style = TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1F2937")),
            ('ALIGN', (0,0), (-1,0), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E5E7EB")),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            
            # Merges for Section titles
            ('SPAN', (0, 1), (2, 1)),
            ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor("#F3F4F6")),
            
            ('SPAN', (0, 5), (2, 5)),
            ('BACKGROUND', (0, 5), (-1, 5), colors.HexColor("#F3F4F6")),
            
            # Merges for Totals
            ('SPAN', (0, 4), (1, 4)),
            ('SPAN', (0, 7), (1, 7)),
            ('SPAN', (0, 8), (1, 8)),
            
            # Style for Net Profit
            ('BACKGROUND', (0, 8), (-1, 8), colors.HexColor("#D1FAE5")),
            ('LINEABOVE', (0, 8), (-1, 8), 1.5, colors.HexColor("#047857")),
            ('LINEBELOW', (0, 8), (-1, 8), 1.5, colors.HexColor("#047857")),
        ])
        
        pnl_table.setStyle(t_style)
        story.append(pnl_table)

        doc.build(story)
        pdf_bytes = buffer.getvalue()
        
        filename = f"Laporan_PnL_{tanggal}.pdf"
        return pdf_bytes, filename

    @staticmethod
    def export_kantin_pdf(tanggal_str=None, kasir_id=None, metode_pembayaran=None):
        """Mengekspor laporan omzet kantin ke PDF."""
        import io
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
        from reportlab.lib.units import cm

        # Ambil data
        data = ReportService.get_laporan_kantin_by_tanggal(tanggal_str, kasir_id, page=1, per_page=100000, metode_pembayaran=metode_pembayaran)
        tanggal = data["tanggal"]

        # Fetch warnet info from settings repository (same as get_struk_data)
        warnet_title = SettingsRepository.get("warnet_title") or "TMBilling"
        warnet_address = SettingsRepository.get("warnet_address") or "Jl. Merdeka No. 123, Kota"
        warnet_phone = SettingsRepository.get("warnet_phone") or "0812-3456-7890"

        # Buffer PDF
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=1.5*cm,
            leftMargin=1.5*cm,
            topMargin=1.5*cm,
            bottomMargin=1.5*cm
        )

        styles = getSampleStyleSheet()
        
        # Custom styles
        style_title = ParagraphStyle(
            name="TitleStyle",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            textColor=colors.HexColor("#1F2937"),
            alignment=1, # Center
            spaceAfter=6
        )
        style_subtitle = ParagraphStyle(
            name="SubTitleStyle",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10,
            textColor=colors.HexColor("#4B5563"),
            alignment=1, # Center
            spaceAfter=15
        )
        style_section = ParagraphStyle(
            name="SectionStyle",
            parent=styles["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=12,
            textColor=colors.HexColor("#1F2937"),
            spaceBefore=10,
            spaceAfter=6
        )
        style_meta = ParagraphStyle(
            name="MetaStyle",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10,
            textColor=colors.HexColor("#1F2937")
        )
        style_table_header = ParagraphStyle(
            name="TableHeaderStyle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            textColor=colors.white,
            alignment=1 # Center
        )
        style_table_cell = ParagraphStyle(
            name="TableCellStyle",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            textColor=colors.HexColor("#374151")
        )
        style_table_cell_center = ParagraphStyle(
            name="TableCellCenterStyle",
            parent=style_table_cell,
            alignment=1 # Center
        )
        style_table_cell_right = ParagraphStyle(
            name="TableCellRightStyle",
            parent=style_table_cell,
            alignment=2 # Right
        )
        style_total = ParagraphStyle(
            name="TotalStyle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10,
            textColor=colors.HexColor("#1F2937"),
            alignment=2 # Right
        )

        story = []

        # Warnet Header (Kop Laporan)
        story.append(Paragraph(warnet_title, style_title))
        story.append(Paragraph(f"{warnet_address} | Telp: {warnet_phone}", style_subtitle))
        story.append(Spacer(1, 0.5*cm))

        # Judul Laporan
        story.append(Paragraph("LAPORAN OMZET KANTIN / F&B", style_section))
        story.append(Spacer(1, 0.2*cm))

        # Meta info kasir & date
        nama_kasir = "Semua Kasir"
        if kasir_id:
            from app.repositories import UserRepository
            u = UserRepository.get_by_id(kasir_id)
            if u:
                nama_kasir = u.nama_lengkap or u.username

        meta_data = [
            [Paragraph(f"<b>Tanggal Laporan:</b> {tanggal}", style_meta), Paragraph(f"<b>Kasir:</b> {nama_kasir}", style_meta)],
            [Paragraph(f"<b>Waktu Cetak:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", style_meta), Paragraph("", style_meta)]
        ]
        meta_table = Table(meta_data, colWidths=[9*cm, 9*cm])
        meta_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 0.6*cm))

        # Table data Kantin
        history_menu = data.get("history_menu", [])
        
        # Define table headers and col widths (A4 width without margins = ~18cm)
        headers = [
            Paragraph("Waktu", style_table_header),
            Paragraph("No. Nota", style_table_header),
            Paragraph("Item Menu", style_table_header),
            Paragraph("Qty", style_table_header),
            Paragraph("Total Harga", style_table_header),
            Paragraph("Metode", style_table_header),
            Paragraph("Pemesanan", style_table_header),
            Paragraph("Kasir", style_table_header)
        ]
        
        table_data = [headers]
        
        for idx, tm in enumerate(history_menu, 1):
            waktu = tm.get("waktu", "-")
            no_nota = tm.get("no_nota", "-")
            menu_nama = tm.get("menu_nama", "-")
            jumlah = str(tm.get("jumlah", 0))
            
            # Format Rupiah
            total_harga_raw = tm.get("total_harga", 0)
            total_harga = f"Rp {total_harga_raw:,.0f}"
            
            metode = tm.get("metode_pembayaran", "Tunai") or "Tunai"
            pc_kode = tm.get("pc_kode", "-")
            pemesanan = "Take Away" if pc_kode != "Tempat" else "Makan di Tempat"
            kasir_nama = tm.get("kasir_nama", "-")
            
            row = [
                Paragraph(waktu, style_table_cell_center),
                Paragraph(no_nota, style_table_cell_center),
                Paragraph(menu_nama, style_table_cell),
                Paragraph(jumlah, style_table_cell_center),
                Paragraph(total_harga, style_table_cell_right),
                Paragraph(metode, style_table_cell_center),
                Paragraph(pemesanan, style_table_cell_center),
                Paragraph(kasir_nama, style_table_cell_center)
            ]
            table_data.append(row)

        col_widths = [2.5*cm, 2.3*cm, 3.5*cm, 0.8*cm, 2.5*cm, 2.2*cm, 2.5*cm, 1.7*cm]
        data_table = Table(table_data, colWidths=col_widths, repeatRows=1)
        
        # Style table
        t_style = TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#374151")), # Dark gray header
            ('ALIGN', (0,0), (-1,0), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#D1D5DB")),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ])
        
        # Alternate row backgrounds
        for i in range(1, len(table_data)):
            if i % 2 == 0:
                t_style.add('BACKGROUND', (0, i), (-1, i), colors.HexColor("#F9FAFB"))
                
        data_table.setStyle(t_style)
        story.append(data_table)
        story.append(Spacer(1, 0.4*cm))

        # Total Section
        total_omzet_raw = data.get("total_pendapatan_menu", 0)
        total_omzet = f"Rp {total_omzet_raw:,.0f}"
        
        total_data = [
            ["", "", "", Paragraph("<b>TOTAL OMZET KANTIN:</b>", style_total), Paragraph(total_omzet, style_total)]
        ]
        # Total col widths to match the rightmost alignment of the table
        total_col_widths = [2.7*cm, 2.5*cm, 4.0*cm, 3.8*cm, 5.0*cm]
        total_table = Table(total_data, colWidths=total_col_widths)
        total_table.setStyle(TableStyle([
            ('ALIGN', (3,0), (-1,-1), 'RIGHT'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 8),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ('GRID', (3,0), (4,0), 1, colors.HexColor("#1F2937")),
            ('BACKGROUND', (3,0), (4,0), colors.HexColor("#F3F4F6")),
        ]))
        story.append(total_table)

        # Build PDF
        doc.build(story)
        pdf_bytes = buffer.getvalue()
        
        filename = f"Laporan_Kantin_{tanggal}_{nama_kasir.replace(' ', '_')}.pdf"
        return pdf_bytes, filename

    @staticmethod
    def export_audit_pdf(filter_text=""):
        """Mengekspor audit log / system logs ke PDF terstruktur."""
        import io
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
        from reportlab.lib.units import cm

        # Ambil logs parsed (limit besar agar terambil semua)
        data = ReportService.get_system_logs(limit=10000, filter_text=filter_text)
        logs = data.get("logs", [])

        warnet_title = SettingsRepository.get("warnet_title") or "TMBilling"
        warnet_address = SettingsRepository.get("warnet_address") or "Jl. Merdeka No. 123, Kota"
        warnet_phone = SettingsRepository.get("warnet_phone") or "0812-3456-7890"

        # Buffer PDF
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=1.0*cm,
            leftMargin=1.0*cm,
            topMargin=1.2*cm,
            bottomMargin=1.2*cm
        )

        styles = getSampleStyleSheet()
        
        style_title = ParagraphStyle(
            name="TitleStyle",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            textColor=colors.HexColor("#1F2937"),
            alignment=1, # Center
            spaceAfter=6
        )
        style_subtitle = ParagraphStyle(
            name="SubTitleStyle",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10,
            textColor=colors.HexColor("#4B5563"),
            alignment=1, # Center
            spaceAfter=15
        )
        style_section = ParagraphStyle(
            name="SectionStyle",
            parent=styles["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=12,
            textColor=colors.HexColor("#1F2937"),
            spaceBefore=10,
            spaceAfter=6
        )
        style_meta = ParagraphStyle(
            name="MetaStyle",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10,
            textColor=colors.HexColor("#1F2937")
        )
        style_table_header = ParagraphStyle(
            name="TableHeaderStyle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            textColor=colors.white,
            alignment=1 # Center
        )
        style_table_cell = ParagraphStyle(
            name="TableCellStyle",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=7.5,
            textColor=colors.HexColor("#374151")
        )
        style_table_cell_center = ParagraphStyle(
            name="TableCellCenterStyle",
            parent=style_table_cell,
            alignment=1 # Center
        )

        story = []

        # Warnet Header (Kop Laporan)
        story.append(Paragraph(warnet_title, style_title))
        story.append(Paragraph(f"{warnet_address} | Telp: {warnet_phone}", style_subtitle))
        story.append(Spacer(1, 0.4*cm))

        # Judul Laporan
        story.append(Paragraph("AUDIT LOG / AKTIVITAS SISTEM", style_section))
        story.append(Spacer(1, 0.2*cm))

        # Meta info
        meta_data = [
            [Paragraph(f"<b>Filter Pencarian:</b> {filter_text or 'Semua Logs'}", style_meta)],
            [Paragraph(f"<b>Waktu Cetak:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", style_meta)]
        ]
        meta_table = Table(meta_data, colWidths=[19.0*cm])
        meta_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 0.5*cm))

        # Table data
        headers = [
            Paragraph("Timestamp", style_table_header),
            Paragraph("User", style_table_header),
            Paragraph("Kategori", style_table_header),
            Paragraph("Aksi / Event", style_table_header),
            Paragraph("Detail", style_table_header)
        ]
        
        table_data = [headers]
        
        for log in logs:
            import json
            detail_str = log.get("detail", "")
            
            ip = log.get("ip_address", "-")
            if ip and ip != "-":
                detail_str += f"<br/><b>IP:</b> {ip}"
                
            agent = log.get("browser_agent", "-")
            if agent and agent != "-":
                agent_short = agent[:50] + ("..." if len(agent) > 50 else "")
                detail_str += f"<br/><b>Agent:</b> {agent_short}"
                
            det_json = log.get("detail_json")
            if det_json:
                try:
                    json_str = json.dumps(det_json, indent=2) if not isinstance(det_json, str) else det_json
                    json_html = str(json_str).replace('<', '&lt;').replace('>', '&gt;').replace('\n', '<br/>').replace(' ', '&nbsp;')
                    detail_str += f"<br/><b>Data:</b><br/>{json_html}"
                except Exception:
                    detail_str += f"<br/><b>Data:</b> {str(det_json)}"

            row = [
                Paragraph(log.get("timestamp", ""), style_table_cell_center),
                Paragraph(log.get("user", ""), style_table_cell_center),
                Paragraph(log.get("category", ""), style_table_cell_center),
                Paragraph(log.get("action", ""), style_table_cell_center),
                Paragraph(detail_str, style_table_cell)
            ]
            table_data.append(row)

        col_widths = [3.2*cm, 1.8*cm, 1.8*cm, 3.2*cm, 9.0*cm]
        data_table = Table(table_data, colWidths=col_widths, repeatRows=1)
        
        # Style table
        t_style = TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#374151")),
            ('ALIGN', (0,0), (-1,0), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#D1D5DB")),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ])
        
        for i in range(1, len(table_data)):
            if i % 2 == 0:
                t_style.add('BACKGROUND', (0, i), (-1, i), colors.HexColor("#F9FAFB"))
                
        data_table.setStyle(t_style)
        story.append(data_table)

        doc.build(story)
        pdf_bytes = buffer.getvalue()
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"Audit_Log_{timestamp}.pdf"
        return pdf_bytes, filename