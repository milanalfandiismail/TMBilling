"""Pembatas percobaan login gagal per (IP, username), in-memory.

shortcut: hitungan hilang saat server restart, upgrade ke tabel DB bila perlu audit lintas restart.
"""

import time
from threading import Lock

MAX_FAILURES = 5
WINDOW_SECONDS = 300

_failures = {}
_lock = Lock()


def _prune(key, now):
    attempts = [t for t in _failures.get(key, []) if now - t < WINDOW_SECONDS]
    if attempts:
        _failures[key] = attempts
    else:
        _failures.pop(key, None)
    return attempts


def is_blocked(key):
    """True bila percobaan gagal untuk key ini sudah mencapai batas dalam window."""
    now = time.monotonic()
    with _lock:
        return len(_prune(key, now)) >= MAX_FAILURES


def record_failure(key):
    now = time.monotonic()
    with _lock:
        _failures.setdefault(key, []).append(now)


def clear(key):
    with _lock:
        _failures.pop(key, None)
