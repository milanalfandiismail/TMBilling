import threading

# shortcut: lock proses-level, cukup untuk 1 proses Waitress; pindah ke UPDATE atomik bila multi-proses
WRITE_LOCK = threading.RLock()
