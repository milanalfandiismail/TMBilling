# app/services/dashboard_service.py

"""Service untuk data dashboard kasir.

Modul ini mengagregasi data PC, sesi, dan status online
untuk ditampilkan di dashboard utama kasir.
"""

import time

from app.services.sesi.sesi_service import SesiService
from app.services.pc.pc_service import PCService
from app.repositories import TransaksiRepository, MenuRepository
from app.models import now_local, Sesi, PC, db

_OMZET_TTL_SECONDS = 5
_omzet_cache = {"key": None, "value": None, "ts": 0.0}


class DashboardService:
    """Service untuk business logic dashboard."""

    @staticmethod
    def clear_omzet_cache():
        _omzet_cache.update(key=None, value=None, ts=0.0)

    @staticmethod
    def _get_omzet(hari_ini):
        key = hari_ini.isoformat()
        now_ts = time.monotonic()
        if _omzet_cache["key"] == key and now_ts - _omzet_cache["ts"] < _OMZET_TTL_SECONDS:
            return _omzet_cache["value"]
        value = (
            int(TransaksiRepository.get_total_pendapatan_hari_ini(hari_ini) or 0),
            int(MenuRepository.get_total_pemasukan_by_date(hari_ini) or 0),
        )
        _omzet_cache.update(key=key, value=value, ts=now_ts)
        return value

    # =========================================================================
    # 2. DATA AGGREGATION (REAL-TIME STATUS)
    # =========================================================================
    # Fokus: Mengolah status PC, durasi sesi, dan grouping untuk tampilan grid.

    @staticmethod
    def get_pc_list():
        """Ambil daftar PC lengkap dengan status online & detail sesi aktif."""
        # A. Ambil semua PC aktif
        pcs = PCService.get_all(aktif_only=True)
        pc_list = []
        by_grup = {}
        grup_meta = {}
        now = now_local()

        from sqlalchemy.orm import joinedload
        # Batch fetch sesi aktif dalam 1 query tunggal dengan joinedload (eliminasi N+1)
        active_sessions = (
            Sesi.query.options(
                joinedload(Sesi.member),
                joinedload(Sesi.user),
                joinedload(Sesi.paket),
                joinedload(Sesi.pc).joinedload(PC.grup),
            )
            .filter_by(status='aktif')
            .order_by(Sesi.id.desc())
            .all()
        )
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
            
            # C. Cek Status Online & Heartbeat (In-Memory First dengan fallback DB)
            from app.services.cache.memory_store import (
                OnlineStatusStore,
                HardwareMetricsStore,
                ProcessMemoryStore,
                AntiTheftGraceTracker,
                ApiKeyMismatchStore
            )
            status_koneksi = "offline"
            online = False
            is_key_mismatch = ApiKeyMismatchStore.is_mismatch(pc_id=pc.id, ip=pc.ip_address)

            if is_key_mismatch:
                # PC terdeteksi mencoba request tapi API Key tidak valid / mismatch
                status_koneksi = "api_key_mismatch"
                online = False  # Jangan nyala bang!
                OnlineStatusStore.remove(pc.id)
                ProcessMemoryStore.remove(pc.id)
                AntiTheftGraceTracker.mark_offline(pc.id)
            elif OnlineStatusStore.is_online(pc.id, timeout_seconds=15):
                online = True
                status_koneksi = "online"
            elif pc.last_activity:
                diff_seconds = abs((now - pc.last_activity).total_seconds())
                if diff_seconds < 15:
                    online = True
                    status_koneksi = "online"

            if not online and not is_key_mismatch:
                # Jika koneksi hilang tapi sedang ada sesi aktif / mode admin -> Oranye (Warning)
                if sesi_aktif or pc.is_admin_mode:
                    status_koneksi = "no_heartbeat"
                # Bersihkan snapshot proses PC offline dari RAM untuk efisiensi server
                ProcessMemoryStore.remove(pc.id)
                AntiTheftGraceTracker.mark_offline(pc.id)

            pc_dict['online'] = online
            pc_dict['status_koneksi'] = status_koneksi
            pc_dict['api_key_mismatch'] = is_key_mismatch
            
            # --- Active Window & Hardware Telemetry for Dashboard Card (Live RAM Store) ---
            cached_hw = HardwareMetricsStore.get(pc.id)
            pc_dict['active_window'] = cached_hw.get('active_window', pc.hardware.active_window if pc.hardware else "")
            pc_dict['nic_speed'] = cached_hw.get('nic_speed', pc.hardware.nic_speed if pc.hardware else None)
            pc_dict['hardware_mismatch'] = cached_hw.get('hardware_mismatch', bool(pc.hardware and pc.hardware.hardware_mismatch))
            pc_dict['hardware_mismatch_desc'] = cached_hw.get('hardware_mismatch_desc', pc.hardware.hardware_mismatch_desc if pc.hardware else None)
            
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
        total_billing, total_menu = DashboardService._get_omzet(hari_ini)
        omzet_hari_ini = total_billing + total_menu

        return {
            "pc_list": pc_list, 
            "by_grup": by_grup,
            "grup_meta": grup_meta,
            "omzet_hari_ini": omzet_hari_ini,
            "omzet_billing": int(total_billing or 0),
            "omzet_kantin": int(total_menu or 0)
        }