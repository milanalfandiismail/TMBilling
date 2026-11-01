"""In-memory store untuk pengaturan global (Settings) dan resolusi cepat jaringan PC (IP/MAC).

Menyediakan:
1. SettingsCacheStore: Write-through cache di RAM untuk key-value settings.
2. PCNetworkCacheStore: Pemetaan cepat IP dan MAC address ke PC metadata di RAM,
   mengeliminasi ~80 query SELECT berulang per detik pada polling client dan telemetry hardware.
"""

import threading


class SettingsCacheStore:
    """Write-through in-memory cache untuk pengaturan global (Settings)."""
    _lock = threading.Lock()
    _cache = None  # dict of key -> value

    @classmethod
    def get(cls, key: str, default=None):
        with cls._lock:
            if cls._cache is None:
                cls._warmup()
            return cls._cache.get(key, default)

    @classmethod
    def get_all(cls) -> dict:
        with cls._lock:
            if cls._cache is None:
                cls._warmup()
            return dict(cls._cache)

    @classmethod
    def set(cls, key: str, value: str):
        with cls._lock:
            if cls._cache is None:
                cls._warmup()
            cls._cache[key] = str(value)

    @classmethod
    def invalidate(cls):
        with cls._lock:
            cls._cache = None

    @classmethod
    def _warmup(cls):
        from app.models import Settings
        cls._cache = {}
        try:
            items = Settings.query.all()
            for item in items:
                cls._cache[item.key] = item.value
        except Exception:
            pass


class PCNetworkCacheStore:
    """In-memory cache untuk lookup cepat IP & MAC address ke PC ID (0ms resolution)."""
    _lock = threading.Lock()
    _by_ip = {}   # ip_address -> dict info
    _by_mac = {}  # mac_address (uppercase, colon) -> dict info
    _initialized = False

    @classmethod
    def resolve_pc(cls, ip: str = None, mac: str = None) -> dict:
        """Resolve PC dari RAM berdasarkan IP atau MAC address."""
        with cls._lock:
            if not cls._initialized:
                cls._rebuild_cache()

            if ip and ip in cls._by_ip:
                return cls._by_ip[ip]

            if mac:
                norm_mac = mac.upper().replace("-", ":").strip()
                if norm_mac in cls._by_mac:
                    return cls._by_mac[norm_mac]

            return None

    @classmethod
    def get_by_ip(cls, ip: str) -> dict:
        """Alias helper untuk resolve PC via IP address."""
        return cls.resolve_pc(ip=ip)

    @classmethod
    def get_by_mac(cls, mac: str) -> dict:
        """Alias helper untuk resolve PC via MAC address."""
        return cls.resolve_pc(mac=mac)

    @classmethod
    def invalidate(cls):
        """Invalidasi cache agar dibangun ulang saat PC ditambah, diubah, atau dihapus."""
        with cls._lock:
            cls._initialized = False
            cls._by_ip.clear()
            cls._by_mac.clear()

    @classmethod
    def clear(cls):
        cls.invalidate()

    @classmethod
    def _rebuild_cache(cls):
        from app.models import PC
        try:
            pcs = PC.query.all()
            cls._by_ip.clear()
            cls._by_mac.clear()
            for pc in pcs:
                entry = {
                    "id": pc.id,
                    "kode": pc.kode,
                    "ip": pc.ip_address,
                    "mac": pc.mac_address,
                    "is_admin_mode": bool(pc.is_admin_mode),
                    "pc_grup_id": pc.grup_id
                }
                if pc.ip_address:
                    cls._by_ip[pc.ip_address] = entry
                if pc.mac_address:
                    norm_mac = pc.mac_address.upper().replace("-", ":").strip()
                    cls._by_mac[norm_mac] = entry
            cls._initialized = True
        except Exception:
            pass
