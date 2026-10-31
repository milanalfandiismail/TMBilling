"""In-memory store untuk telemetry hardware dan task manager PC client.

Menyediakan:
1. ProcessMemoryStore: Snapshot task manager (daftar proses aktif) PC di RAM.
2. HardwareMetricsStore: Metrik telemetry hardware (CPU, GPU, RAM %, active window, nic speed).
3. TelemetryHistoryStore: Sliding window 3 snapshot per PC untuk deteksi overload kerja (CPU/RAM > 90%).
"""

import time
import threading


class ProcessMemoryStore:
    """Store in-memory untuk daftar proses (Task Manager) PC client."""
    _lock = threading.Lock()
    _store = {}  # pc_id -> list of {"name": str, "title": str}

    @classmethod
    def set(cls, pc_id: int, process_list: list):
        if not isinstance(process_list, list):
            return
        cleaned = []
        for p in process_list:
            if isinstance(p, dict):
                cleaned.append({
                    "name": p.get("Name", p.get("name", "Unknown")),
                    "title": p.get("Title", p.get("title", ""))
                })
        with cls._lock:
            cls._store[pc_id] = cleaned

    @classmethod
    def get(cls, pc_id: int) -> list:
        with cls._lock:
            procs = cls._store.get(pc_id)
            return list(procs) if procs is not None else []

    @classmethod
    def remove(cls, pc_id: int):
        with cls._lock:
            cls._store.pop(pc_id, None)

    @classmethod
    def clear(cls):
        with cls._lock:
            cls._store.clear()


class HardwareMetricsStore:
    """Store in-memory untuk metrik telemetry real-time (suhu CPU/GPU, RAM %, active window, nic speed)."""
    _lock = threading.Lock()
    _store = {}  # pc_id -> dict metrics

    @classmethod
    def set(cls, pc_id: int, metrics: dict):
        if not isinstance(metrics, dict):
            return
        with cls._lock:
            prev = cls._store.get(pc_id, {})
            merged = {**prev, **metrics, "updated_at": time.time()}
            cls._store[pc_id] = merged

    @classmethod
    def get(cls, pc_id: int) -> dict:
        with cls._lock:
            data = cls._store.get(pc_id)
            return dict(data) if data is not None else {}

    @classmethod
    def get_all(cls) -> dict:
        with cls._lock:
            return {k: dict(v) for k, v in cls._store.items()}

    @classmethod
    def remove(cls, pc_id: int):
        with cls._lock:
            cls._store.pop(pc_id, None)

    @classmethod
    def clear(cls):
        with cls._lock:
            cls._store.clear()


class TelemetryHistoryStore:
    """Store in-memory histori telemetry beban kerja PC (sliding window max 3 snapshot)."""
    _lock = threading.Lock()
    _store = {}  # pc_id -> list of {"cpu_usage": float, "ram_usage_pct": float}

    @classmethod
    def push_metric(cls, pc_id: int, cpu_usage: float, ram_usage_pct: float, max_len: int = 3):
        with cls._lock:
            history = cls._store.setdefault(pc_id, [])
            history.append({
                "cpu_usage": cpu_usage,
                "ram_usage_pct": ram_usage_pct
            })
            if len(history) > max_len:
                history.pop(0)

    @classmethod
    def get(cls, pc_id: int) -> list:
        with cls._lock:
            h = cls._store.get(pc_id)
            return list(h) if h is not None else []

    @classmethod
    def remove(cls, pc_id: int):
        with cls._lock:
            cls._store.pop(pc_id, None)

    @classmethod
    def clear(cls):
        with cls._lock:
            cls._store.clear()
