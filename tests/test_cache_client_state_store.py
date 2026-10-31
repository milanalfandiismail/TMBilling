"""Unit tests untuk app.services.cache.client_state_store."""

import time
import pytest
from app.services.cache.client_state_store import (
    OnlineStatusStore,
    AntiTheftGraceTracker
)


def test_online_status_store_ping_and_timeout():
    OnlineStatusStore.clear()
    assert OnlineStatusStore.is_online(1) is False
    assert OnlineStatusStore.get_diff_seconds(1) > 1000.0

    # Mark active
    OnlineStatusStore.mark_active(1)
    assert OnlineStatusStore.is_online(1, timeout_seconds=15) is True
    assert OnlineStatusStore.get_diff_seconds(1) < 1.0

    # Simulate timeout
    OnlineStatusStore._last_ping_ts[1] = time.time() - 20.0
    assert OnlineStatusStore.is_online(1, timeout_seconds=15) is False
    assert OnlineStatusStore.get_diff_seconds(1) >= 20.0

    # Cleanup
    OnlineStatusStore.remove(1)
    assert OnlineStatusStore.is_online(1) is False


def test_antitheft_grace_tracker():
    AntiTheftGraceTracker.clear_all()
    assert AntiTheftGraceTracker.is_in_grace_period(1) is False

    # Record boot
    AntiTheftGraceTracker.record_boot_if_needed(1)
    assert AntiTheftGraceTracker.is_in_grace_period(1, grace_seconds=60) is True

    # Calling again does not overwrite original boot timestamp
    first_ts = AntiTheftGraceTracker._boot_timestamps[1]
    time.sleep(0.01)
    AntiTheftGraceTracker.record_boot_if_needed(1)
    assert AntiTheftGraceTracker._boot_timestamps[1] == first_ts

    # Simulate grace period expired (> 60s)
    AntiTheftGraceTracker._boot_timestamps[1] = time.time() - 65.0
    assert AntiTheftGraceTracker.is_in_grace_period(1, grace_seconds=60) is False

    # Mark offline resets the boot timestamp
    AntiTheftGraceTracker.mark_offline(1)
    assert 1 not in AntiTheftGraceTracker._boot_timestamps
    assert AntiTheftGraceTracker.is_in_grace_period(1) is False
