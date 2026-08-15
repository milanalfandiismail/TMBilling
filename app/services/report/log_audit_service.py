# app/services/report/log_audit_service.py

"""Service khusus pemrosesan & pembersihan log audit sistem.

Modul ini menangani manajemen file log: pembacaan log ber-kategori,
pembersihan log, serta penghapusan riwayat audit.
"""

import re
import json
from datetime import datetime
from app.models import db
from app.repositories import TransaksiRepository, SesiRepository
from app.utils.logger import read_logs, write_log, clear_logs


class LogAuditService:
    """Service untuk manajemen file log & audit trail."""

    @staticmethod
    def get_system_logs(limit=500, filter_text="", kategori=""):
        """Ambil isi log sistem untuk ditampilkan di dashboard kasir, parse jadi JSON."""
        raw_logs = read_logs(5000, filter_text if filter_text else None)

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

            category = "sistem"
            action_upper = action.upper()

            if any(k in action_upper for k in ["TRANSAKSI", "STRUK", "REFUND", "CLEAR_TANGGAL"]):
                category = "transaksi"
            elif any(k in action_upper for k in ["SESI", "TAMBAH_WAKTU", "PINDAH_PC", "BUKA_GUEST", "BUKA_MEMBER"]):
                category = "sesi"
            elif "BLACKOUT" in action_upper:
                category = "blackout"

            if kategori and kategori != "Semua":
                kategori_lower = kategori.lower()
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
