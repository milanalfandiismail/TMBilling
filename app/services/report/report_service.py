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
    def get_laporan_by_tanggal(tanggal_str=None, kasir_id=None, page=1, per_page=10):
        """Laporan mendalam berdasarkan filter tanggal tertentu (dan opsional kasir_id) dengan pagination."""
        try:
            if tanggal_str:
                tanggal = datetime.strptime(tanggal_str, "%Y-%m-%d").date()
            else:
                tanggal = now_local().date()

            # 1. Ambil angka dasar pendapatan & refund (Filter Kasir)
            total_pendapatan_billing = TransaksiRepository.get_total_pemasukan(tanggal, kasir_id)
            total_refund = TransaksiRepository.get_total_refund(tanggal, kasir_id)
            
            # Ambil pendapatan F&B
            from app.repositories import MenuRepository
            total_pendapatan_menu = MenuRepository.get_total_pemasukan_by_date(tanggal, kasir_id)
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
            pagination = TransaksiRepository.get_history_nota_paginated(tanggal, page, per_page, kasir_id)
            history_struk = pagination.items

            # Ambil seluruh history transaksi menu/F&B pada hari tersebut
            history_menu_raw = MenuRepository.get_transactions_by_date(tanggal, kasir_id)
            history_menu = [
                {
                    "id": tm.id,
                    "no_nota": tm.no_nota,
                    "menu_nama": tm.menu.nama if tm.menu else "Menu Terhapus",
                    "jumlah": tm.jumlah,
                    "total_harga": tm.total_harga,
                    "pc_kode": tm.pc_kode or "-",
                    "waktu": format_display(tm.tanggal) if tm.tanggal else "-",
                    "kasir_nama": tm.kasir.username if tm.kasir else "System",
                    "tunai": tm.tunai,
                    "kembalian": tm.kembalian,
                } for tm in history_menu_raw
            ]

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
                "pendapatan_guest": ReportService.get_pendapatan_kategori(tanggal, 'guest', kasir_id),
                "pendapatan_member": ReportService.get_pendapatan_kategori(tanggal, 'member', kasir_id),
                # Footer & Histori
                "sesi_aktif": len(SesiRepository.get_all_aktif()),
                "history_struk": ReportService._format_history_struk(history_struk),
                "history_menu": history_menu
            }
        except Exception as e:
            raise Exception(f"Gagal hitung laporan: {str(e)}")

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
            "warnet_title": warnet_title,
            "warnet_address": warnet_address,
            "warnet_phone": warnet_phone,
            "warnet_footer": warnet_footer,
        }

    @staticmethod
    def get_struk_menu_data(t_menu_id, kasir_name="Kasir"):
        """Mengambil dan memetakan data transaksi menu ke format struk belanja."""
        from app.repositories import MenuRepository
        tm = MenuRepository.get_transaksi_by_id(t_menu_id)
        if not tm:
            return None

        # Penentuan nama kasir (prioritas nama lengkap)
        nama_kasir = "Kasir"
        if tm.kasir:
            nama_kasir = tm.kasir.nama_lengkap or tm.kasir.username
        else:
            nama_kasir = kasir_name

        # Ambil pengaturan dinamis nota (nama, alamat, telepon, footer)
        warnet_title = SettingsRepository.get("warnet_title") or "TMBilling"
        warnet_address = SettingsRepository.get("warnet_address") or "Jl. Merdeka No. 123, Kota"
        warnet_phone = SettingsRepository.get("warnet_phone") or "0812-3456-7890"
        warnet_footer = SettingsRepository.get("warnet_footer") or "Terima kasih atas kunjungan Anda!"

        return {
            "no_nota": tm.no_nota,
            "tanggal": format_display(tm.tanggal) if tm.tanggal else "",
            "pc_kode": tm.pc_kode or "-",
            "tipe": "kantin",
            "nama_pelanggan": "Pelanggan POS",
            "rincian": [{"keterangan": tm.menu.nama if tm.menu else "Menu Terhapus", "durasi": tm.jumlah, "harga": tm.total_harga}],
            "total_durasi": tm.jumlah,
            "total_harga": tm.total_harga,
            "kasir": nama_kasir,
            "tunai": tm.tunai,
            "kembalian": tm.kembalian,
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
        pattern = re.compile(r"^\[(.*?)\] \[(.*?)\] (.*?) - (.*)$")
        
        parsed_logs = []
        for line in raw_logs:
            match = pattern.match(line)
            if match:
                timestamp, user, action, detail = match.groups()
                
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
                        
                parsed_logs.append({
                    "timestamp": timestamp,
                    "user": user,
                    "action": action,
                    "detail": detail,
                    "category": category,
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
                        "detail": ""
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
            if TransaksiRepository.delete_by_id(t_id):
                db.session.commit()
                write_log("DELETE_STRUK", f"Struk {nota} dihapus permanen", user=operator)
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
    def get_pendapatan_kategori(tanggal, kategori, kasir_id=None):
        """Menghitung pendapatan per kategori (Logic Mapping yang dipindah dari Repo)."""
        if kategori == 'guest':
            jenis = ["beli_paket_guest", "tambah_waktu_guest"]
        else:
            jenis = ["beli_paket_member", "tambah_waktu_sesi"]
        
        return TransaksiRepository.get_total_pendapatan_by_tanggal(tanggal, jenis, kasir_id)

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
                "jenis": t.jenis or ""
            })
        return formatted