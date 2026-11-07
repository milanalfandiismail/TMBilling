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
        for k in [k for k, v in _failures.items() if not v or now - v[-1] >= WINDOW_SECONDS]:
            _failures.pop(k, None)
        _failures.setdefault(key, []).append(now)


def clear(key):
    with _lock:
        _failures.pop(key, None)


MAX_FAILURES_PER_IP = 20


def _ip_key(ip):
    return ("__ip__", ip)


def check(ip, username):
    return is_blocked((ip, username)) or is_blocked(_ip_key(ip))


def fail(ip, username):
    record_failure((ip, username))
    record_failure(_ip_key(ip))


def ok(ip, username):
    clear((ip, username))
    clear(_ip_key(ip))
