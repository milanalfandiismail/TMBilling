"""Unit tests untuk app.services.cache.telemetry_store."""

import pytest
from app.services.cache.telemetry_store import (
    ProcessMemoryStore,
    HardwareMetricsStore,
    TelemetryHistoryStore
)


def test_process_memory_store_crud():
    ProcessMemoryStore.clear()
    assert ProcessMemoryStore.get(1) == []

    # Set process list
    procs = [
        {"Name": "chrome.exe", "Title": "YouTube"},
        {"Name": "game.exe", "Title": "Valorant"}
    ]
    ProcessMemoryStore.set(1, procs)
    saved = ProcessMemoryStore.get(1)
    assert len(saved) == 2
    assert saved[0]["name"] == "chrome.exe"
    assert saved[1]["title"] == "Valorant"

    # Remove single PC
    ProcessMemoryStore.remove(1)
    assert ProcessMemoryStore.get(1) == []


def test_hardware_metrics_store():
    HardwareMetricsStore.clear()
    assert HardwareMetricsStore.get(10) == {}

    # Set initial metrics
    HardwareMetricsStore.set(10, {
        "cpu_usage": 45.2,
        "cpu_temp": 55.0,
        "gpu_temp": 60.0,
        "nic_speed": "1 Gbps"
    })
    data = HardwareMetricsStore.get(10)
    assert data["cpu_usage"] == 45.2
    assert data["nic_speed"] == "1 Gbps"
    assert "updated_at" in data

    # Partial merge update
    HardwareMetricsStore.set(10, {"cpu_usage": 80.0})
    merged = HardwareMetricsStore.get(10)
    assert merged["cpu_usage"] == 80.0
    assert merged["nic_speed"] == "1 Gbps"

    # Get all
    HardwareMetricsStore.set(20, {"cpu_usage": 12.0})
    all_data = HardwareMetricsStore.get_all()
    assert 10 in all_data and 20 in all_data

    # Cleanup
    HardwareMetricsStore.remove(10)
    assert HardwareMetricsStore.get(10) == {}
    HardwareMetricsStore.clear()
    assert HardwareMetricsStore.get_all() == {}


def test_telemetry_history_store_sliding_window():
    TelemetryHistoryStore.clear()
    assert TelemetryHistoryStore.get(5) == []

    # Push 3 metrics
    TelemetryHistoryStore.push_metric(5, 50.0, 40.0)
    TelemetryHistoryStore.push_metric(5, 60.0, 50.0)
    TelemetryHistoryStore.push_metric(5, 70.0, 60.0)
    h = TelemetryHistoryStore.get(5)
    assert len(h) == 3
    assert h[0]["cpu_usage"] == 50.0
    assert h[2]["cpu_usage"] == 70.0

    # 4th push pops the oldest (sliding window max 3)
    TelemetryHistoryStore.push_metric(5, 95.0, 92.0)
    h = TelemetryHistoryStore.get(5)
    assert len(h) == 3
    assert h[0]["cpu_usage"] == 60.0
    assert h[2]["cpu_usage"] == 95.0

    TelemetryHistoryStore.remove(5)
    assert TelemetryHistoryStore.get(5) == []
