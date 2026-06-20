# app/utils/timezone_utils.py

"""Helper functions untuk multi-timezone support.

Semua timestamp di DB disimpan dalam UTC (aware datetime).
Timezone setting menentukan zona display di frontend.

Constants:
    UTC (timezone): UTC timezone object
    WIB (ZoneInfo): Asia/Jakarta (UTC+7)
    WITA (ZoneInfo): Asia/Makassar (UTC+8)
    WIT (ZoneInfo): Asia/Jayapura (UTC+9)
    DEFAULT_TZ (str): Default timezone = Asia/Makassar
    TIMEZONE_CHOICES (list): Daftar timezone yang tersedia di Settings
"""

from datetime import datetime, timezone
from zoneinfo import ZoneInfo, available_timezones

# Sumber waktu absolut
UTC = timezone.utc
WIB = ZoneInfo("Asia/Jakarta")
WITA = ZoneInfo("Asia/Makassar")
WIT = ZoneInfo("Asia/Jayapura")

DEFAULT_TZ = "Asia/Makassar"

TIMEZONE_CHOICES = [
    {"value": "Asia/Jakarta", "label": "WIB (UTC+7) — Jakarta, Sumatra, Jawa, Kalimantan Barat/Tengah"},
    {"value": "Asia/Makassar", "label": "WITA (UTC+8) — Makassar, Bali, NTT, Sulawesi, Kalimantan Timur/Selatan"},
    {"value": "Asia/Jayapura", "label": "WIT (UTC+9) — Jayapura, Maluku, Papua"},
    {"value": "Asia/Kuala_Lumpur", "label": "WPM (UTC+8) — Malaysia"},
    {"value": "Asia/Singapore", "label": "SGT (UTC+8) — Singapore"},
    {"value": "Asia/Ho_Chi_Minh", "label": "ICT (UTC+7) — Vietnam"},
    {"value": "Asia/Bangkok", "label": "ICT (UTC+7) — Thailand"},
    {"value": "Asia/Manila", "label": "PHT (UTC+8) — Philippines"},
    {"value": "Europe/London", "label": "GMT/BST (UTC+0/1) — UK"},
    {"value": "Europe/Berlin", "label": "CET/CEST (UTC+1/2) — Germany"},
    {"value": "America/New_York", "label": "EST/EDT (UTC-5/4) — New York"},
    {"value": "America/Los_Angeles", "label": "PST/PDT (UTC-8/7) — California"},
    {"value": "Asia/Tokyo", "label": "JST (UTC+9) — Japan"},
    {"value": "Asia/Seoul", "label": "KST (UTC+9) — Korea"},
    {"value": "Australia/Sydney", "label": "AEST/AEDT (UTC+10/11) — Sydney"},
    {"value": "Pacific/Auckland", "label": "NZST/NZDT (UTC+12/13) — New Zealand"},
]


def now_utc():
    """Mendapatkan waktu UTC saat ini.
    
    Sumber waktu absolut untuk semua timestamp di aplikasi.
    Menggantikan now_local() yang sebelumnya return naive datetime.
    
    Returns:
        datetime: Aware datetime dalam UTC.
    """
    return datetime.now(UTC)


def get_display_tz(tz_name=None):
    """Mendapatkan ZoneInfo object dari setting timezone.
    
    Args:
        tz_name (str, optional): Nama timezone (contoh: "Asia/Makassar").
                                  Jika None, baca dari database settings.
                                  Jika gagal, fallback ke DEFAULT_TZ.
    
    Returns:
        ZoneInfo: Timezone object untuk konversi.
    """
    if tz_name:
        try:
            return ZoneInfo(tz_name)
        except (KeyError, TypeError):
            pass

    try:
        from app.services import SettingsService
        saved = SettingsService.get("timezone", DEFAULT_TZ)
        return ZoneInfo(saved)
    except Exception:
        return ZoneInfo(DEFAULT_TZ)


def ensure_utc(dt):
    """Memastikan datetime dalam format UTC naive.
    
    Jika dt aware (ada tzinfo), konversi ke UTC lalu strip.
    Jika dt naive, asumsikan sudah UTC (setelah migrasi berjalan).
    Data existing (WIB) harus di-migrasi dulu lewat script terpisah.
    
    Args:
        dt (datetime): Datetime yang akan di-ensure.
    
    Returns:
        datetime: Naive datetime dalam UTC.
    """
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(UTC).replace(tzinfo=None)
    return dt  # sudah UTC naive (data baru atau sudah di-migrasi)


def display_in_tz(dt, tz_name=None):
    """Konversi UTC (naive) datetime ke timezone display.
    
    Args:
        dt (datetime): Datetime UTC naive.
        tz_name (str, optional): Nama timezone tujuan.
    
    Returns:
        datetime: Aware datetime dalam timezone display.
    """
    if dt is None:
        return None
    # dt naive = UTC
    utc_dt = dt.replace(tzinfo=UTC)
    tz = get_display_tz(tz_name)
    return utc_dt.astimezone(tz)


def format_display(dt, tz_name=None, fmt="%d/%m/%Y %H:%M"):
    """Format UTC datetime ke string dengan timezone display.
    
    Args:
        dt (datetime): Datetime UTC.
        tz_name (str, optional): Nama timezone.
        fmt (str, optional): Format strftime. Default "%d/%m/%Y %H:%M".
    
    Returns:
        str: String datetime yang sudah diformat, atau "-" jika dt None.
    """
    if dt is None:
        return "-"
    local = display_in_tz(dt, tz_name)
    tz_label = get_tz_short_name(tz_name)
    return f"{local.strftime(fmt)} {tz_label}"


def get_tz_short_name(tz_name=None):
    """Dapatkan label singkat timezone (WIB/WITA/WIT/dll).
    
    Args:
        tz_name (str, optional): Nama timezone. Jika None, baca dari DB.
    
    Returns:
        str: Label singkat timezone (contoh: "WITA").
    """
    if tz_name is None:
        try:
            from app.services import SettingsService
            tz_name = SettingsService.get("timezone", DEFAULT_TZ)
        except Exception:
            tz_name = DEFAULT_TZ

    labels = {
        "Asia/Jakarta": "WIB",
        "Asia/Makassar": "WITA",
        "Asia/Jayapura": "WIT",
        "Asia/Kuala_Lumpur": "MYT",
        "Asia/Singapore": "SGT",
        "Asia/Ho_Chi_Minh": "ICT",
        "Asia/Bangkok": "ICT",
        "Asia/Manila": "PHT",
        "Europe/London": "GMT",
        "Europe/Berlin": "CET",
        "America/New_York": "EST",
        "America/Los_Angeles": "PST",
        "Asia/Tokyo": "JST",
        "Asia/Seoul": "KST",
        "Australia/Sydney": "AEST",
        "Pacific/Auckland": "NZST",
    }
    return labels.get(tz_name, tz_name.split("/")[-1].replace("_", " "))
