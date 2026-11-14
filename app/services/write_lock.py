import threading
import time

SLOW_ACQUIRE_SECONDS = 1.0


class _WriteLock:
    """Gerbang tulis SQLite (satu proses Waitress) dengan pencatatan antrean lambat."""

    # shortcut: lock proses-level, cukup untuk 1 proses Waitress; pindah ke UPDATE atomik bila multi-proses
    def __init__(self):
        self._lock = threading.RLock()

    def acquire(self, blocking=True, timeout=-1):
        mulai = time.monotonic()
        hasil = self._lock.acquire(blocking, timeout)
        tunggu = time.monotonic() - mulai
        if hasil and tunggu >= SLOW_ACQUIRE_SECONDS:
            from app.utils.logger import write_log
            write_log("WRITE_LOCK_SLOW", f"Menunggu lock {tunggu:.2f} detik")
        return hasil

    def release(self):
        self._lock.release()

    def __enter__(self):
        self.acquire()
        return self

    def __exit__(self, exc_type, exc, tb):
        self.release()
        return False


WRITE_LOCK = _WriteLock()
