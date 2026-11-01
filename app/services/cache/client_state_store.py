"""In-memory store untuk status koneksi client dan audit toleransi boot anti-theft.

Menyediakan:
1. OnlineStatusStore: Pelacakan detak jantung polling PC client (< 15 detik = Online).
2. AntiTheftGraceTracker: Pelacakan masa toleransi booting (60 detik) untuk pencegahan false alarm GPU.
"""

import time
import threading
from app.models.base.base import now_local


class OnlineStatusStore:
    """Store in-memory untuk melacak status online dan heartbeat PC client."""
    _lock = threading.Lock()
    _last_ping_ts = {}  # pc_id -> float (time.time())
    _last_activity_dt = {}  # pc_id -> datetime (local timezone)

    @classmethod
    def mark_active(cls, pc_id: int, dt=None):
        ts = time.time()
        activity_dt = dt or now_local()
        with cls._lock:
            cls._last_ping_ts[pc_id] = ts
            cls._last_activity_dt[pc_id] = activity_dt

    @classmethod
    def is_online(cls, pc_id: int, timeout_seconds: int = 15) -> bool:
        with cls._lock:
            ts = cls._last_ping_ts.get(pc_id)
            if not ts:
                return False
            return (time.time() - ts) < timeout_seconds

    @classmethod
    def get_diff_seconds(cls, pc_id: int) -> float:
        with cls._lock:
            ts = cls._last_ping_ts.get(pc_id)
            if not ts:
                return 999999.0
            return max(0.0, time.time() - ts)

    @classmethod
    def remove(cls, pc_id: int):
        with cls._lock:
            cls._last_ping_ts.pop(pc_id, None)
            cls._last_activity_dt.pop(pc_id, None)

    @classmethod
    def clear(cls):
        with cls._lock:
            cls._last_ping_ts.clear()
            cls._last_activity_dt.clear()


class AntiTheftGraceTracker:
    """Store in-memory untuk melacak masa toleransi (Grace Period) inisialisasi hardware saat cold boot."""
    _lock = threading.Lock()
    _boot_timestamps = {}  # pc_id -> float (time.time())

    @classmethod
    def record_boot_if_needed(cls, pc_id: int):
        with cls._lock:
            if pc_id not in cls._boot_timestamps:
                cls._boot_timestamps[pc_id] = time.time()

    @classmethod
    def is_in_grace_period(cls, pc_id: int, grace_seconds: int = 60) -> bool:
        with cls._lock:
            boot_ts = cls._boot_timestamps.get(pc_id)
            if not boot_ts:
                return False
            return (time.time() - boot_ts) < grace_seconds

    @classmethod
    def mark_offline(cls, pc_id: int):
        """Saat PC terdeteksi mati, reset timestamp boot agar boot berikutnya dapat grace period 60 detik."""
        with cls._lock:
            cls._boot_timestamps.pop(pc_id, None)

    @classmethod
    def clear_all(cls):
        with cls._lock:
            cls._boot_timestamps.clear()

    @classmethod
    def clear(cls):
        """Alias untuk standardisasi interface reset store."""
        cls.clear_all()


class ApiKeyMismatchStore:
    """Store in-memory untuk melacak PC client yang mencoba connect tapi API key tidak valid / mismatch."""
    _lock = threading.Lock()
    _mismatch_ips = {}     # ip_address -> float (time.time())
    _mismatch_pc_ids = {}  # pc_id -> float (time.time())

    @classmethod
    def record_mismatch(cls, ip: str = None, pc_id: int = None):
        """Catat waktu mismatch API key untuk IP dan/atau PC ID."""
        ts = time.time()
        with cls._lock:
            if ip:
                cls._mismatch_ips[ip] = ts
            if pc_id:
                cls._mismatch_pc_ids[pc_id] = ts

    @classmethod
    def is_mismatch(cls, pc_id: int = None, ip: str = None, timeout_seconds: int = 30) -> bool:
        """Cek apakah PC ID atau IP sedang dalam status mismatch API key aktif."""
        ts = time.time()
        with cls._lock:
            if pc_id and pc_id in cls._mismatch_pc_ids:
                if (ts - cls._mismatch_pc_ids[pc_id]) < timeout_seconds:
                    return True
                else:
                    cls._mismatch_pc_ids.pop(pc_id, None)

            if ip and ip in cls._mismatch_ips:
                if (ts - cls._mismatch_ips[ip]) < timeout_seconds:
                    return True
                else:
                    cls._mismatch_ips.pop(ip, None)

            return False

    @classmethod
    def clear_mismatch(cls, ip: str = None, pc_id: int = None):
        """Hapus status mismatch saat PC berhasil mengirim request dengan API key yang sah."""
        with cls._lock:
            if ip:
                cls._mismatch_ips.pop(ip, None)
            if pc_id:
                cls._mismatch_pc_ids.pop(pc_id, None)

    @classmethod
    def clear_all(cls):
        with cls._lock:
            cls._mismatch_ips.clear()
            cls._mismatch_pc_ids.clear()

    @classmethod
    def clear(cls):
        cls.clear_all()

