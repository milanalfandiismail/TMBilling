# app/services/uptime_service.py

"""Service untuk manajemen dan pelaporan log uptime PC.

Module ini mengelola pencatatan detak jantung (heartbeat) PC
dan menghitung utilisasi harian. Menggunakan In-Memory Store untuk
menghindari penulisan disk SQLite setiap detik, dengan batch flush
berkala setiap 1 menit.
"""

from datetime import datetime, timedelta, date
from sqlalchemy.orm import joinedload

from app.models import db, PCUptimeLog, PC, Sesi
from app.utils.helpers import natural_sort_key
from app.utils.logger import write_log
from app.utils.timezone_utils import now_utc, get_display_tz, display_in_tz


class UptimeService:
    """Service untuk agregasi dan pencatatan log uptime PC (In-Memory Powered)."""

    @staticmethod
    def record_heartbeat(pc_id, is_billing=None):
        """Mencatat detak jantung PC ke In-Memory Uptime Store.
        
        Zero Disk I/O: Menghindari commit ke database SQLite setiap detik.
        Akumulasi akan di-flush ke tabel pc_uptime_log secara batch setiap 1 menit.
        
        Args:
            pc_id (int): ID PC yang mengirim heartbeat telemetry.
            is_billing (bool, optional): Apakah PC sedang dalam sesi billing aktif.
        """
        try:
            from app.services.cache.uptime_store import UptimeMemoryStore
            if is_billing is None:
                pc = PC.query.get(pc_id)
                is_billing = bool(pc and pc.sesi_aktif)
            UptimeMemoryStore.record_heartbeat(pc_id, is_billing=is_billing)
        except Exception as e:
            write_log("UPTIME_SERVICE_ERROR", f"Gagal mencatat heartbeat PC ID {pc_id}: {str(e)}")

    @staticmethod
    def flush_uptime_to_db(app=None):
        """Flush akumulasi uptime dari RAM ke database SQLite."""
        try:
            from app.services.cache.uptime_store import UptimeMemoryStore
            UptimeMemoryStore.flush_to_database(app=app)
        except Exception as e:
            write_log("UPTIME_SERVICE_ERROR", f"Gagal flush uptime ke database: {str(e)}")

    @staticmethod
    def get_daily_report(tanggal):
        """Mengambil data uptime seluruh PC pada tanggal tertentu.
        
        Args:
            tanggal (date): Objek tanggal.
            
        Returns:
            list: List dictionary berisi laporan uptime per PC.
        """
        try:
            # Akumulasi RAM sudah di-flush scheduler run_flush_uptime tiap 60 detik
            # (run.py); GET tidak boleh menulis.
            logs = PCUptimeLog.query.options(
                joinedload(PCUptimeLog.pc).joinedload(PC.grup)
            ).filter_by(tanggal=tanggal).all()
            # Urutkan berdasarkan grup_id dan kode PC secara natural
            logs_sorted = sorted(logs, key=lambda log: (log.pc.grup_id if (log.pc and log.pc.grup_id) else 0, natural_sort_key(log.pc.kode if log.pc else "")))
            return [log.to_dict() for log in logs_sorted]
        except Exception as e:
            write_log("UPTIME_SERVICE_ERROR", f"Gagal mengambil laporan harian {tanggal}: {str(e)}")
            return []

    @staticmethod
    def get_range_report(start_date, end_date):
        """Mengambil ringkasan data uptime untuk rentang tanggal tertentu, teragregasi per PC.
        
        Args:
            start_date (date): Tanggal mulai.
            end_date (date): Tanggal akhir.
            
        Returns:
            dict: Berisi 'summary' (agregat total) dan 'pcs' (detail per PC).
        """
        try:
            # Akumulasi RAM sudah di-flush scheduler run_flush_uptime tiap 60 detik
            # (run.py); GET tidak boleh menulis.

            # Query log dalam rentang tanggal
            logs = PCUptimeLog.query.options(
                joinedload(PCUptimeLog.pc).joinedload(PC.grup)
            ).filter(
                PCUptimeLog.tanggal >= start_date,
                PCUptimeLog.tanggal <= end_date
            ).all()

            # Agregasikan data per PC
            pc_stats = {}
            total_seconds_online = 0
            total_seconds_billing = 0

            for log in logs:
                pc_kode = log.pc.kode if log.pc else f"PC-ID-{log.pc_id}"
                grup_nama = log.pc.grup.nama if log.pc and log.pc.grup else "reguler"
                grup_warna = log.pc.grup.warna if log.pc and log.pc.grup and log.pc.grup.warna else "#888888"
                grup_id = log.pc.grup_id if log.pc else 0
                
                if pc_kode not in pc_stats:
                    pc_stats[pc_kode] = {
                        "pc_kode": pc_kode,
                        "grup": grup_nama,
                        "grup_warna": grup_warna,
                        "pc_grup_id": grup_id,
                        "total_online_seconds": 0,
                        "total_billing_seconds": 0,
                        "hari_aktif": 0
                    }
                
                pc_stats[pc_kode]["total_online_seconds"] += log.total_online_seconds
                pc_stats[pc_kode]["total_billing_seconds"] += log.total_billing_seconds
                if log.total_online_seconds > 0:
                    pc_stats[pc_kode]["hari_aktif"] += 1
                
                total_seconds_online += log.total_online_seconds
                total_seconds_billing += log.total_billing_seconds

            # Format list PC
            pcs_list = []
            for pc_kode, stats in pc_stats.items():
                on_menit = round(stats["total_online_seconds"] / 60, 1)
                bill_menit = round(stats["total_billing_seconds"] / 60, 1)
                utilisasi = 0.0
                if stats["total_online_seconds"] > 0:
                    utilisasi = round((stats["total_billing_seconds"] / stats["total_online_seconds"]) * 100, 1)
                    if utilisasi > 100.0:
                        utilisasi = 100.0

                pcs_list.append({
                    "pc_kode": stats["pc_kode"],
                    "grup": stats["grup"],
                    "grup_warna": stats["grup_warna"],
                    "pc_grup_id": stats["pc_grup_id"],
                    "total_online_menit": on_menit,
                    "total_billing_menit": bill_menit,
                    "hari_aktif": stats["hari_aktif"],
                    "utilisasi_persen": utilisasi
                })

            pcs_list.sort(key=lambda item: (item.get("pc_grup_id", 0), natural_sort_key(item.get("pc_kode", ""))))

            summary_online_menit = round(total_seconds_online / 60, 1)
            summary_billing_menit = round(total_seconds_billing / 60, 1)
            summary_utilisasi = 0.0
            if total_seconds_online > 0:
                summary_utilisasi = round((total_seconds_billing / total_seconds_online) * 100, 1)
                if summary_utilisasi > 100.0:
                    summary_utilisasi = 100.0

            return {
                "summary": {
                    "total_online_menit": summary_online_menit,
                    "total_billing_menit": summary_billing_menit,
                    "utilisasi_persen": summary_utilisasi,
                    "total_pc_tercatat": len(pcs_list)
                },
                "pcs": pcs_list
            }

        except Exception as e:
            write_log("UPTIME_SERVICE_ERROR", f"Gagal mengambil laporan rentang {start_date} s/d {end_date}: {str(e)}")
            return {
                "summary": {"total_online_menit": 0, "total_billing_menit": 0, "utilisasi_persen": 0, "total_pc_tercatat": 0},
                "pcs": []
            }
