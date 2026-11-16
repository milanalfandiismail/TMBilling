import threading
from contextlib import contextmanager

# Hitungan konteks aktif: request restore yang tumpang tindih tidak boleh
# saling mematikan gerbang maintenance saat yang lain masih berjalan.
_lock = threading.Lock()
_active_count = 0


def enable() -> None:
    global _active_count
    with _lock:
        _active_count += 1


def disable() -> None:
    global _active_count
    with _lock:
        if _active_count > 0:
            _active_count -= 1


def is_active() -> bool:
    with _lock:
        return _active_count > 0


@contextmanager
def restoring():
    enable()
    try:
        yield
    finally:
        disable()
