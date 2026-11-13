"""Penjaga permintaan duplikat untuk jalur uang.

shortcut: kunci hidup di memori satu proses (Waitress 8 thread) dan hilang saat
restart; cukup untuk retry detik-menit. Naikkan ke tabel DB bila perlu tahan restart.
"""
import threading
import time

_TTL_SECONDS = 600
_MAX_KEYS = 5000
_seen = {}
_lock = threading.Lock()


def claim(key, ttl_seconds=_TTL_SECONDS):
    """True bila kunci baru, False bila sudah dipakai dalam TTL. Kunci kosong selalu True."""
    if not key:
        return True
    now = time.monotonic()
    with _lock:
        for k in [k for k, ts in _seen.items() if now - ts > ttl_seconds]:
            del _seen[k]
        if len(_seen) > _MAX_KEYS:
            _seen.clear()
        if key in _seen:
            return False
        _seen[key] = now
        return True


def reset():
    """Kosongkan semua kunci. Dipakai tes."""
    with _lock:
        _seen.clear()
