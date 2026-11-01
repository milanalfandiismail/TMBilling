"""Facade backward-compatibility untuk app.services.cache.

Seluruh store kini dipecah ke sub-modul domain-driven:
- telemetry_store: ProcessMemoryStore, HardwareMetricsStore, TelemetryHistoryStore
- client_state_store: OnlineStatusStore, AntiTheftGraceTracker
- command_store: CommandQueueStore, CommandQueueDict, PENDING_COMMANDS, PENDING_FAST_COMMANDS
- uptime_store: UptimeMemoryStore
- system_cache_store: SettingsCacheStore, PCNetworkCacheStore

File ini dipertahankan sebagai re-export facade agar kode & tes legacy tetap kompatibel.
"""

from app.services.cache import (
    ProcessMemoryStore,
    HardwareMetricsStore,
    TelemetryHistoryStore,
    OnlineStatusStore,
    AntiTheftGraceTracker,
    ApiKeyMismatchStore,
    CommandQueueStore,
    CommandQueueDict,
    PENDING_COMMANDS,
    PENDING_FAST_COMMANDS,
    PENDING_VNC_COMMANDS,
    UptimeMemoryStore,
    SettingsCacheStore,
    PCNetworkCacheStore,
    cleanup_pc_cache,
    reset_all_cache
)

__all__ = [
    "ProcessMemoryStore",
    "HardwareMetricsStore",
    "TelemetryHistoryStore",
    "OnlineStatusStore",
    "AntiTheftGraceTracker",
    "ApiKeyMismatchStore",
    "CommandQueueStore",
    "CommandQueueDict",
    "PENDING_COMMANDS",
    "PENDING_FAST_COMMANDS",
    "PENDING_VNC_COMMANDS",
    "UptimeMemoryStore",
    "SettingsCacheStore",
    "PCNetworkCacheStore",
    "cleanup_pc_cache",
    "reset_all_cache"
]
