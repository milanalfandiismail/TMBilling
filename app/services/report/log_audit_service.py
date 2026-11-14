# app/services/report/log_audit_service.py

"""Service khusus pemrosesan & pembersihan log audit sistem.

Modul ini menangani manajemen file log: pembacaan log ber-kategori,
pembersihan log, serta penghapusan riwayat audit.
"""

import re
import json
from app.models import db
from app.repositories import TransaksiRepository, SesiRepository, MenuRepository
from app.services.write_lock import WRITE_LOCK
from app.utils.timezone_utils import format_local_now
from app.utils.logger import read_logs, write_log, clear_logs
from app.utils.timezone_utils import get_local_date_range_utc


LOCKED_TRANSAKSI_JENIS = frozenset({
    "beli_paket_guest", "beli_paket_member",
    "tambah_waktu_sesi", "tambah_waktu_guest",
    "refund_paket", "blackout_refund",
})


class LogAuditService:
    """Service untuk manajemen file log & audit trail."""

    @staticmethod
    def get_system_logs(limit=500, filter_text="", kategori=""):
        """Ambil isi log sistem untuk ditampilkan di dashboard kasir, parse jadi JSON."""
        raw_logs = read_logs(5000, filter_text if filter_text else None)

        pattern = re.compile(r"^\[(.*?)\] \[(.*?)\] (.*?) - (.*)$")

        parsed_logs = []
        for line in raw_logs:
            data = None
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

            from app.utils.logger import ACTION_TO_CATEGORY_MAP
            if isinstance(data, dict) and 'category' in data:
                category = data['category']
            else:
                category = ACTION_TO_CATEGORY_MAP.get(action.upper(), "SYSTEM")

            match_filter = True
            if kategori and kategori != "Semua":
                kat_lower = kategori.lower()
                cat_upper = category.upper()
                act_upper = action.upper()
                if kat_lower == "transaksi":
                    match_filter = cat_upper in ["TRANSACTION", "PAYMENT_BILLING"]
                elif kat_lower == "sesi":
                    match_filter = cat_upper == "SESI_BILLING"
                elif kat_lower == "blackout":
                    match_filter = "BLACKOUT" in act_upper
                elif kat_lower == "sistem":
                    match_filter = (cat_upper not in ["TRANSACTION", "PAYMENT_BILLING", "SESI_BILLING"]) and ("BLACKOUT" not in act_upper)
                else:
                    match_filter = cat_upper == kategori.upper()

            if not match_filter:
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
    def clear_system_logs(operator="system", archive=True):
        """Bersihkan file log dengan auto-archive dan pencatatan log audit terstruktur."""
        res = clear_logs(archive=archive)
        if res.get("success"):
            detail_clear = {
                "total_dibersihkan": res.get("total_lines", 0),
                "diarsipkan": bool(res.get("archive_path")),
                "lokasi_arsip": res.get("archive_path") or "-",
                "dieksekusi_oleh": operator
            }
            write_log(
                "CLEAR_LOG",
                f"Log sistem dibersihkan ({res.get('total_lines', 0)} baris diarsipkan)",
                user=operator,
                detail_json=detail_clear
            )
            return {
                "success": True,
                "total_dibersihkan": res.get("total_lines", 0),
                "archive_path": res.get("archive_path")
            }
        return {"success": False, "total_dibersihkan": 0, "archive_path": None}

    @staticmethod
    def clear_all_transactions(operator="system"):
        """Menghapus seluruh riwayat transaksi & sesi (Maintenance)."""
        if SesiRepository.get_all_aktif():
            raise ValueError("Tutup semua sesi aktif sebelum menghapus riwayat")
        try:
            count_t = TransaksiRepository.delete_all()
            count_m = MenuRepository.delete_all_transaksi()
            count_s = SesiRepository.delete_history()
            db.session.commit()
            write_log(
                "CLEAR_ALL_HISTORY",
                f"Seluruh riwayat dikosongkan ({count_t} transaksi, {count_m} kantin, {count_s} sesi)",
                user=operator,
                detail_json={"transaksi_dihapus": count_t, "menu_dihapus": count_m, "sesi_dihapus": count_s, "action": "clear_all"}
            )
            return True
        except Exception as e:
            try:
                db.session.rollback()
            except Exception:
                pass
            write_log("ERROR", f"Gagal hapus seluruh riwayat: {str(e)}", user=operator, detail_json={"error": str(e)})
            return False

    @staticmethod
    def delete_transaction(t_id, operator="system"):
        """Menghapus satu transaksi (Audit)."""
        t = TransaksiRepository.get_by_id(t_id)
        if t and t.jenis in LOCKED_TRANSAKSI_JENIS:
            raise ValueError("Nota paket tidak bisa dihapus. Gunakan Refund agar saldo member ikut kembali.")
        try:
            if not t:
                return False

            nota = t.no_nota or f"ID:{t_id}"

            t_detail = {
                "no_nota": t.no_nota,
                "total": t.jumlah if hasattr(t, 'jumlah') else 0,
                "metode_pembayaran": t.metode_pembayaran if hasattr(t, 'metode_pembayaran') else (t.tipe_pembayaran if hasattr(t, 'tipe_pembayaran') else "-"),
                "jenis": t.jenis if hasattr(t, 'jenis') else "-",
                "pelanggan": t.member.username if t.member else (t.sesi.nama_guest if hasattr(t, 'sesi') and t.sesi else "Guest")
            }

            if TransaksiRepository.delete_by_id(t_id):
                db.session.commit()
                write_log("DELETE_STRUK", f"Struk {nota} dihapus permanen", user=operator, detail_json=t_detail)
                return True
            return False
        except Exception as e:
            try:
                db.session.rollback()
            except Exception:
                pass
            write_log("ERROR", f"Gagal hapus struk {t_id}: {str(e)}", user=operator, detail_json={"error": str(e)})
            return False

    @staticmethod
    def clear_transactions_by_date(tanggal, operator="system"):
        """Menghapus riwayat transaksi & sesi pada tanggal tertentu (Audit)."""
        # Cek sesi aktif dan hapus riwayat harus satu blok dengan pembukaan sesi
        # (WRITE_LOCK) agar nota sesi yang baru dibuka tidak ikut terhapus.
        with WRITE_LOCK:
            _, target_end = get_local_date_range_utc(tanggal)
            for sesi in SesiRepository.get_all_aktif():
                mulai = sesi.mulai_pada or sesi.waktu_mulai_sesi
                if mulai and mulai < target_end:
                    raise ValueError(
                        "Tutup semua sesi aktif sebelum menghapus riwayat tanggal ini"
                    )
            try:
                count_t = TransaksiRepository.delete_by_date(tanggal)
                count_m = MenuRepository.delete_transaksi_by_date(tanggal)
                count_s = SesiRepository.delete_history_by_date(tanggal)
                db.session.commit()
            except Exception as e:
                try:
                    db.session.rollback()
                except Exception:
                    pass
                write_log("ERROR", f"Gagal hapus riwayat tanggal {tanggal}: {str(e)}", user=operator, detail_json={"error": str(e), "tanggal_target": tanggal})
                return False

        write_log(
            "CLEAR_TANGGAL",
            f"Riwayat tanggal {tanggal} dihapus ({count_t} transaksi, {count_m} kantin, {count_s} sesi)",
            user=operator,
            detail_json={"tanggal_target": tanggal, "transaksi_dihapus": count_t, "menu_dihapus": count_m, "sesi_dihapus": count_s}
        )
        return True

    @staticmethod
    def prepare_export_data(filter_text=""):
        """Siapkan data log untuk di-export ke file eksternal."""
        logs = read_logs(5000, filter_text if filter_text else None)
        content = "\n".join(logs)
        timestamp = format_local_now("%Y%m%d_%H%M%S")
        return content, timestamp
