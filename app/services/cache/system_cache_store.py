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
    _missing = set()  # key yang dipastikan tidak ada di DB (cache negatif)
    _complete = False  # True bila _cache memuat seluruh key yang ada di DB

    @classmethod
    def get(cls, key: str, default=None):
        data = cls._snapshot()
        return data.get(key, default)

    @classmethod
    def get_all(cls) -> dict:
        return dict(cls._snapshot())

    @classmethod
    def set(cls, key: str, value: str):
        with cls._lock:
            if cls._cache is None:
                cls._cache = {}
                cls._complete = False
            cls._cache[key] = str(value)
            cls._missing.discard(key)

    @classmethod
    def update_dict(cls, data: dict):
        with cls._lock:
            if cls._cache is None:
                cls._cache = {}
            cls._cache.update({str(k): str(v) for k, v in (data or {}).items()})
            cls._missing.clear()
            # Caller mengirim SELURUH tabel settings, jadi snapshot cache sudah lengkap.
            cls._complete = True

    @classmethod
    def invalidate(cls):
        with cls._lock:
            cls._cache = None
            cls._complete = False
            cls._missing = set()

    @classmethod
    def mark_missing(cls, key: str):
        """Tandai key sebagai tidak ada di DB supaya tidak di-query ulang."""
        with cls._lock:
            cls._missing.add(key)

    @classmethod
    def is_missing(cls, key: str) -> bool:
        with cls._lock:
            return key in cls._missing

    @classmethod
    def is_complete(cls) -> bool:
        """True bila snapshot cache memuat seluruh key yang ada di DB."""
        with cls._lock:
            return cls._complete

    @classmethod
    def _snapshot(cls):
        with cls._lock:
            if cls._cache is not None:
                return dict(cls._cache)
        data = cls._load_from_db()
        with cls._lock:
            if cls._cache is None and data is not None:
                cls._cache = data
                cls._complete = True
            return dict(cls._cache or {})

    @classmethod
    def _load_from_db(cls) -> dict | None:
        from app.models import Settings
        data = {}
        try:
            for item in Settings.query.all():
                data[item.key] = item.value
        except Exception:
            return None  # load gagal -> snapshot tidak boleh dianggap lengkap
        return data


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
            if cls._initialized:
                return cls._lookup(ip, mac)
        cls._rebuild_cache()
        with cls._lock:
            return cls._lookup(ip, mac)

    @classmethod
    def _lookup(cls, ip: str = None, mac: str = None) -> dict:
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
        """Bangun snapshot baru di luar lock, lalu tukar sekaligus di dalam lock."""
        from app.models import PC
        try:
            pcs = PC.query.all()
        except Exception:
            return

        by_ip = {}
        by_mac = {}
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
                by_ip[pc.ip_address] = entry
            if pc.mac_address:
                norm_mac = pc.mac_address.upper().replace("-", ":").strip()
                by_mac[norm_mac] = entry

        with cls._lock:
            cls._by_ip = by_ip
            cls._by_mac = by_mac
            cls._initialized = True
