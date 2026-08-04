# app/services/hardware/uptime_service.py

"""Service untuk mencatat dan mengelola log uptime dan utilisasi PC client."""

from datetime import datetime
from app.models import db, PCUptimeLog, PC, Sesi
from app.utils.timezone_utils import now_utc, get_display_tz, display_in_tz
from app.utils.logger import write_log


class UptimeService:
    """Service untuk mencatat detak jantung (heartbeat) PC dan menghitung utilisasi harian."""

    @staticmethod
    def record_heartbeat(pc_id):
        """Mencatat detak jantung PC dan memperbarui akumulasi waktu online & billing.
        
        Args:
            pc_id (int): ID PC yang mengirim heartbeat telemetry.
        """
        try:
            # 1. Dapatkan tanggal hari ini berdasarkan zona waktu lokal warnet
            tz = get_display_tz()
            now_local = now_utc().astimezone(tz)
            today = now_local.date()
            
            # Waktu UTC naive untuk disimpan di DB
            now_naive = now_utc().replace(tzinfo=None)

            # 2. Cari atau buat log hari ini untuk PC ini
            log = PCUptimeLog.query.filter_by(pc_id=pc_id, tanggal=today).first()
            
            if not log:
                log = PCUptimeLog(
                    pc_id=pc_id,
                    tanggal=today,
                    first_seen=now_naive,
                    last_seen=now_naive,
                    total_online_seconds=0,
                    total_billing_seconds=0
                )
                db.session.add(log)
                db.session.commit()
                return

            # 3. Hitung selisih waktu dari heartbeat terakhir
            if log.last_seen:
                diff_seconds = (now_naive - log.last_seen).total_seconds()
                
                # Throttling: Hanya akumulasikan jika detak jantung wajar (5 detik s.d 2 menit)
                # Mencegah penambahan durasi saat PC baru menyala kembali setelah mati lama.
                if 5 <= diff_seconds <= 120:
                    log.total_online_seconds += int(diff_seconds)
                    
                    # Cek apakah sedang ada sesi billing aktif di PC ini
                    pc = PC.query.get(pc_id)
                    if pc and pc.sesi_aktif:
                        log.total_billing_seconds += int(diff_seconds)

            # 4. Perbarui waktu detak jantung terakhir
            log.last_seen = now_naive
            db.session.commit()

        except Exception as e:
            db.session.rollback()
            write_log("UPTIME_SERVICE_ERROR", f"Gagal mencatat heartbeat PC ID {pc_id}: {str(e)}")

    @staticmethod
    def get_daily_report(tanggal):
        """Mengambil data uptime seluruh PC pada tanggal tertentu.
        
        Args:
            tanggal (date): Objek tanggal.
            
        Returns:
            list: List dictionary berisi laporan uptime per PC.
        """
        try:
            logs = PCUptimeLog.query.filter_by(tanggal=tanggal).all()
            return [log.to_dict() for log in logs]
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
            # Query log dalam rentang tanggal
            logs = PCUptimeLog.query.filter(
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
                
                if pc_kode not in pc_stats:
                    pc_stats[pc_kode] = {
                        "pc_kode": pc_kode,
                        "grup": grup_nama,
                        "total_online_seconds": 0,
                        "total_billing_seconds": 0,
                        "hari_aktif": 0
                    }
                
                pc_stats[pc_kode]["total_online_seconds"] += log.total_online_seconds
                pc_stats[pc_kode]["total_billing_seconds"] += log.total_billing_seconds
                pc_stats[pc_kode]["hari_aktif"] += 1
                
                total_seconds_online += log.total_online_seconds
                total_seconds_billing += log.total_billing_seconds

            # Format data untuk output
            pc_list = []
            for stat in pc_stats.values():
                online_menit = round(stat["total_online_seconds"] / 60, 1)
                billing_menit = round(stat["total_billing_seconds"] / 60, 1)
                utilisasi = 0.0
                if stat["total_online_seconds"] > 0:
                    utilisasi = round((stat["total_billing_seconds"] / stat["total_online_seconds"]) * 100, 1)
                    if utilisasi > 100.0:
                        utilisasi = 100.0
                
                pc_list.append({
                    "pc_kode": stat["pc_kode"],
                    "grup": stat["grup"],
                    "total_online_menit": online_menit,
                    "total_billing_menit": billing_menit,
                    "utilisasi_persen": utilisasi,
                    "hari_aktif": stat["hari_aktif"]
                })

            # Urutkan secara natural/alphabetical berdasarkan kode PC
            import re
            def natural_sort_key(item):
                return [int(text) if text.isdigit() else text.lower()
                        for text in re.split(r'(\d+)', item["pc_kode"])]
            
            pc_list = sorted(pc_list, key=natural_sort_key)

            # Hitung rata-rata utilisasi keseluruhan
            avg_utilisasi = 0.0
            if total_seconds_online > 0:
                avg_utilisasi = round((total_seconds_billing / total_seconds_online) * 100, 1)

            return {
                "success": True,
                "summary": {
                    "total_online_menit": round(total_seconds_online / 60, 1),
                    "total_billing_menit": round(total_seconds_billing / 60, 1),
                    "avg_utilisasi_persen": avg_utilisasi
                },
                "pcs": pc_list
            }
        except Exception as e:
            write_log("UPTIME_SERVICE_ERROR", f"Gagal mengambil laporan rentang {start_date} s/d {end_date}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "summary": {"total_online_menit": 0, "total_billing_menit": 0, "avg_utilisasi_persen": 0},
                "pcs": []
            }
