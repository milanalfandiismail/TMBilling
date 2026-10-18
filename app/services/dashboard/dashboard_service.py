# app/services/dashboard_service.py

"""Service untuk data dashboard kasir.

Modul ini mengagregasi data PC, sesi, dan status online
untuk ditampilkan di dashboard utama kasir.
"""

from app.services.sesi.sesi_service import SesiService
from app.services.pc.pc_service import PCService
from app.repositories import TransaksiRepository, MenuRepository
from app.utils.logger import write_log
from app.models import now_local, Sesi, db
import time

_last_cleanup_ts = 0.0
CLEANUP_INTERVAL_SECONDS = 15.0


class DashboardService:
    """Service untuk business logic dashboard."""

    # =========================================================================
    # 1. AUDIT & MONITORING (ACCESS)
    # =========================================================================
    # Fokus: Mencatat aktivitas kasir saat membuka dashboard.

    @staticmethod
    def get_dashboard_data(username):
        """Catat log akses dashboard oleh kasir."""
        write_log("ACCESS_DASHBOARD", f"Kasir {username} mengakses dashboard", user=username)
        return {"success": True}


    # =========================================================================
    # 2. DATA AGGREGATION (REAL-TIME STATUS)
    # =========================================================================
    # Fokus: Mengolah status PC, durasi sesi, dan grouping untuk tampilan grid.

    @staticmethod
    def get_pc_list():
        """Ambil daftar PC lengkap dengan status online & detail sesi aktif."""
        # A. Cleanup: Tutup sesi yang sudah expired (throttled 15s agar tidak membebani DB per detik)
        global _last_cleanup_ts
        now_ts = time.time()
        if now_ts - _last_cleanup_ts >= CLEANUP_INTERVAL_SECONDS:
            _last_cleanup_ts = now_ts
            SesiService.cleanup_expired()
            SesiService.cleanup_inactive_admin_sessions()
        
        # B. Ambil semua PC aktif
        pcs = PCService.get_all(aktif_only=True)
        pc_list = []
        by_grup = {}
        grup_meta = {}
        now = now_local()

        # Batch fetch sesi aktif dalam 1 query tunggal (eliminasi N+1)
        active_sessions = Sesi.query.filter_by(status='aktif').order_by(db.text('id DESC')).all()
        sesi_map = {}
        for s in active_sessions:
            if s.pc_id not in sesi_map:
                sesi_map[s.pc_id] = s

        for pc in pcs:
            sesi_aktif = sesi_map.get(pc.id)
            # Screenshot di-load on-demand via API screenshot/status/<id> saat modal dibuka (zero disk I/O di polling 1s)
            pc_dict = pc.to_dict(sesi=sesi_aktif, screenshot_info={})
            
            # Status Admin & System diambil dari DB / to_dict
            pc_dict['is_admin'] = pc_dict.get('is_admin_mode', False)
            pc_dict['is_system'] = pc_dict.get('is_system_mode', False)
            
            # C. Cek Status Online & Heartbeat (Online jika < 15s. Jika >= 15s dan ada sesi/admin -> Oranye/No Heartbeat, jika kosong -> Abu-abu/Offline)
            status_koneksi = "offline"
            online = False
            if pc.last_activity:
                diff_seconds = abs((now - pc.last_activity).total_seconds())
                if diff_seconds < 15:
                    online = True
                    status_koneksi = "online"
                else:
                    # Jika koneksi hilang tapi sedang ada sesi aktif / mode admin -> Oranye (Warning)
                    if sesi_aktif or pc.is_admin_mode:
                        status_koneksi = "no_heartbeat"
            pc_dict['online'] = online
            pc_dict['status_koneksi'] = status_koneksi
            
            # --- Active Window & Hardware Telemetry for Dashboard Card ---
            pc_dict['active_window'] = pc.hardware.active_window if pc.hardware else ""
            pc_dict['nic_speed'] = pc.hardware.nic_speed if pc.hardware else None
            pc_dict['hardware_mismatch'] = bool(pc.hardware and pc.hardware.hardware_mismatch)
            pc_dict['hardware_mismatch_desc'] = pc.hardware.hardware_mismatch_desc if pc.hardware else None
            
            # D. Detail Sesi Aktif (Mapping data sesi ke dalam dict PC)
            if sesi_aktif:
                pc_dict['sesi_detail'] = sesi_aktif.to_dict()
                # Status sudah ditentukan di pc.to_dict() (terpakai/blackout)
            else:
                pc_dict['sesi_detail'] = None
                # Status 'kosong' atau 'admin' juga sudah ada di pc_dict dari pc.to_dict()
            
            # E. Grouping berdasarkan Nama Grup (VIP/Reguler/dll)
            g_nama = pc.grup.nama if pc.grup else "reguler"
            g_warna = pc.grup.warna if pc.grup else "#888888"
            g_id = pc.grup.id if pc.grup else 0
            
            if g_nama not in grup_meta:
                grup_meta[g_nama] = {"warna": g_warna, "id": g_id}
                
            by_grup.setdefault(g_nama, []).append(pc_dict)
            pc_list.append(pc_dict)
        
        # F. Omzet Hari Ini untuk Header Dashboard
        hari_ini = now.date()
        total_billing = TransaksiRepository.get_total_pendapatan_hari_ini(hari_ini)
        total_menu = MenuRepository.get_total_pemasukan_by_date(hari_ini)
        omzet_hari_ini = int(total_billing or 0) + int(total_menu or 0)

        return {
            "pc_list": pc_list, 
            "by_grup": by_grup,
            "grup_meta": grup_meta,
            "omzet_hari_ini": omzet_hari_ini,
            "omzet_billing": int(total_billing or 0),
            "omzet_kantin": int(total_menu or 0)
        }