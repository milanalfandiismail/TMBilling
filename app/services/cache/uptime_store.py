"""In-memory store untuk kalkulasi dan akumulasi uptime & billing PC client.

Menyediakan:
1. UptimeMemoryStore: Menghitung akumulasi detik online dan billing di RAM dengan delta,
   lalu melakukan batch flush ke tabel SQLite pc_uptime_log (tiap 60 detik atau saat server shutdown).
2. Auto-prune entri tanggal lampau (midnight rollover) agar dictionary di RAM tidak bertumbuh tanpa batas.
"""

import time
import logging
import threading
from datetime import datetime, timedelta
from app.utils.timezone_utils import now_utc, get_display_tz

logger = logging.getLogger(__name__)


class UptimeMemoryStore:
    """Store in-memory untuk menghitung akumulasi uptime & billing sebelum di-flush ke SQLite."""
    _lock = threading.Lock()
    _accumulator = {}  # (pc_id, date) -> {"online_delta": int, "billing_delta": int, "last_seen": datetime, "first_seen": datetime}
    _last_seen_ts = {}  # pc_id -> float (time.time())
    _billing = {}  # pc_id -> bool (status billing terakhir yang dilaporkan client)

    @classmethod
    def record_heartbeat(cls, pc_id: int, is_billing: bool = False):
        now_ts = time.time()
        tz = get_display_tz()
        now_dt_local = now_utc().astimezone(tz)
        today = now_dt_local.date()
        now_naive = now_utc().replace(tzinfo=None)

        with cls._lock:
            prev_ts = cls._last_seen_ts.get(pc_id)
            cls._last_seen_ts[pc_id] = now_ts

            key = (pc_id, today)
            entry = cls._accumulator.setdefault(key, {
                "online_delta": 0,
                "billing_delta": 0,
                "first_seen": now_naive,
                "last_seen": now_naive
            })

            entry["last_seen"] = now_naive

            if prev_ts is not None:
                diff_seconds = now_ts - prev_ts
                # Toleransi selisih wajar antara dua heartbeat (1 s/d 30 detik)
                if 0 < diff_seconds <= 30:
                    add_sec = int(round(diff_seconds))
                    entry["online_delta"] += add_sec
                    if is_billing:
                        entry["billing_delta"] += add_sec

    @classmethod
    def set_billing(cls, pc_id: int, is_billing: bool):
        with cls._lock:
            cls._billing[pc_id] = bool(is_billing)

    @classmethod
    def is_billing(cls, pc_id: int) -> bool:
        with cls._lock:
            return cls._billing.get(pc_id, False)

    @classmethod
    def flush_to_database(cls, app=None):
        """Batch update akumulasi uptime dan billing dari RAM ke SQLite (pc_uptime_log)."""
        from app.models import db, PCUptimeLog

        to_flush = []
        tz = get_display_tz()
        current_today = now_utc().astimezone(tz).date()

        with cls._lock:
            # 1. Kumpulkan data yang memiliki delta perubahan
            for (pc_id, today), data in cls._accumulator.items():
                if data["online_delta"] > 0 or data["billing_delta"] > 0:
                    to_flush.append((pc_id, today, data["online_delta"], data["billing_delta"], data["first_seen"], data["last_seen"]))
                    data["online_delta"] = 0
                    data["billing_delta"] = 0

            # 2. Auto-Prune: Bersihkan key tanggal kemarin yang deltas-nya sudah 0
            prune_keys = [
                k for k, v in cls._accumulator.items()
                if k[1] < current_today and v["online_delta"] == 0 and v["billing_delta"] == 0
            ]
            for k in prune_keys:
                cls._accumulator.pop(k, None)

            # Bersihkan flag billing untuk PC yang sudah tidak terlihat
            stale = [pid for pid in cls._billing if pid not in cls._last_seen_ts]
            for pid in stale:
                cls._billing.pop(pid, None)

        if not to_flush:
            return

        def _do_flush():
            try:
                pc_ids = list({item[0] for item in to_flush})
                dates = list({item[1] for item in to_flush})
                existing = {
                    (log.pc_id, log.tanggal): log
                    for log in PCUptimeLog.query.filter(
                        PCUptimeLog.pc_id.in_(pc_ids),
                        PCUptimeLog.tanggal.in_(dates)
                    ).all()
                }

                for pc_id, today, online_sec, billing_sec, first_seen, last_seen in to_flush:
                    log = existing.get((pc_id, today))
                    if not log:
                        log = PCUptimeLog(
                            pc_id=pc_id,
                            tanggal=today,
                            first_seen=first_seen,
                            last_seen=last_seen,
                            total_online_seconds=online_sec,
                            total_billing_seconds=billing_sec
                        )
                        db.session.add(log)
                        existing[(pc_id, today)] = log
                    else:
                        log.total_online_seconds += online_sec
                        log.total_billing_seconds += billing_sec
                        log.last_seen = last_seen
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                logger.error(f"UptimeMemoryStore flush failed: {e}")
                # Jika gagal flush, kembalikan delta ke RAM agar tidak hilang
                with cls._lock:
                    for pc_id, today, online_sec, billing_sec, _, _ in to_flush:
                        key = (pc_id, today)
                        if key in cls._accumulator:
                            cls._accumulator[key]["online_delta"] += online_sec
                            cls._accumulator[key]["billing_delta"] += billing_sec

        if app:
            with app.app_context():
                _do_flush()
        else:
            _do_flush()

    @classmethod
    def remove(cls, pc_id: int):
        with cls._lock:
            cls._last_seen_ts.pop(pc_id, None)
            cls._billing.pop(pc_id, None)
            keys_to_remove = [k for k in cls._accumulator.keys() if k[0] == pc_id]
            for k in keys_to_remove:
                cls._accumulator.pop(k, None)

    @classmethod
    def clear(cls):
        with cls._lock:
            cls._accumulator.clear()
            cls._last_seen_ts.clear()
            cls._billing.clear()
