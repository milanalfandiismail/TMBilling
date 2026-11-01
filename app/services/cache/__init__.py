"""Modul in-memory caching dan transient state management untuk TMBilling.

Menyediakan sub-modul terpusat:
- telemetry_store: ProcessMemoryStore, HardwareMetricsStore, TelemetryHistoryStore
- client_state_store: OnlineStatusStore, AntiTheftGraceTracker
- command_store: CommandQueueStore, CommandQueueDict, PENDING_COMMANDS, PENDING_FAST_COMMANDS
- uptime_store: UptimeMemoryStore
- system_cache_store: SettingsCacheStore, PCNetworkCacheStore

Serta helper satu pintu:
- cleanup_pc_cache(pc_id): Membersihkan seluruh state RAM untuk PC tertentu.
- reset_all_cache(): Membersihkan seluruh in-memory store (untuk testing/reset).
"""

from app.services.cache.telemetry_store import (
    ProcessMemoryStore,
    HardwareMetricsStore,
    TelemetryHistoryStore
)
from app.services.cache.client_state_store import (
    OnlineStatusStore,
    AntiTheftGraceTracker,
    ApiKeyMismatchStore
)
from app.services.cache.command_store import (
    CommandQueueStore,
    CommandQueueDict,
    PENDING_COMMANDS,
    PENDING_FAST_COMMANDS,
    PENDING_VNC_COMMANDS
)
from app.services.cache.uptime_store import (
    UptimeMemoryStore
)
from app.services.cache.system_cache_store import (
    SettingsCacheStore,
    PCNetworkCacheStore
)


def cleanup_pc_cache(pc_id: int):
    """Pembersihan satu pintu untuk seluruh in-memory state saat PC dihapus atau di-reset."""
    if not pc_id:
        return
    ProcessMemoryStore.remove(pc_id)
    HardwareMetricsStore.remove(pc_id)
    TelemetryHistoryStore.remove(pc_id)
    OnlineStatusStore.remove(pc_id)
    AntiTheftGraceTracker.mark_offline(pc_id)
    ApiKeyMismatchStore.clear_mismatch(pc_id=pc_id)
    CommandQueueStore.remove(pc_id)
    UptimeMemoryStore.remove(pc_id)
    PCNetworkCacheStore.invalidate()


def reset_all_cache():
    """Reset seluruh store in-memory (digunakan oleh pytest fixtures atau server reboot)."""
    ProcessMemoryStore.clear()
    HardwareMetricsStore.clear()
    TelemetryHistoryStore.clear()
    OnlineStatusStore.clear()
    AntiTheftGraceTracker.clear_all()
    ApiKeyMismatchStore.clear_all()
    CommandQueueStore.clear()
    UptimeMemoryStore.clear()
    SettingsCacheStore.invalidate()
    PCNetworkCacheStore.invalidate()


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
