# app/services/dashboard_service.py

"""Service untuk data dashboard kasir.

Modul ini mengagregasi data PC, sesi, dan status online
untuk ditampilkan di dashboard utama kasir.
"""

from app.services.sesi_service import SesiService
from app.services.pc_service import PCService
from app.utils.logger import write_log
from app.models.base import now_local


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
        # A. Cleanup: Tutup sesi yang sudah expired sebelum data ditarik
        SesiService.cleanup_expired()
        SesiService.cleanup_inactive_admin_sessions()
        
        # B. Ambil semua PC aktif
        pcs = PCService.get_all(aktif_only=True)
        pc_list = []
        by_grup = {}
        grup_meta = {}
        now = now_local()

        for pc in pcs:
            pc_dict = pc.to_dict()
            
             # Status Admin diambil dari DB
            pc_dict['is_admin'] = pc.is_admin_mode
            
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
                    if pc.sesi_aktif or pc.is_admin_mode:
                        status_koneksi = "no_heartbeat"
            pc_dict['online'] = online
            pc_dict['status_koneksi'] = status_koneksi
            
            # --- NEW: Active Window for Dashboard Card ---
            pc_dict['active_window'] = pc.hardware.active_window if pc.hardware else ""
            
            # D. Detail Sesi Aktif (Mapping data sesi ke dalam dict PC)
            sesi_aktif = pc.sesi_aktif
            if sesi_aktif:
                pc_dict['sesi_detail'] = sesi_aktif.to_dict()
                # Status sudah ditentukan di pc.to_dict() (terpakai/blackout)
            else:
                pc_dict['sesi_detail'] = None
                # Status 'kosong' atau 'admin' juga sudah ada di pc_dict dari pc.to_dict()
            
            # E. Grouping berdasarkan Nama Grup (VIP/Reguler/dll)
            g_nama = pc.grup.nama if pc.grup else "reguler"
            g_warna = pc.grup.warna if pc.grup else "#888888"
            
            if g_nama not in grup_meta:
                grup_meta[g_nama] = {"warna": g_warna}
                
            by_grup.setdefault(g_nama, []).append(pc_dict)
            pc_list.append(pc_dict)
        
        return {
            "pc_list": pc_list, 
            "by_grup": by_grup,
            "grup_meta": grup_meta
        }