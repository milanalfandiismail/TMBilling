import time
from app.services.auth import login_throttle as lt


def test_record_failure_memangkas_entri_kedaluwarsa():
    lt._failures.clear()
    now = time.monotonic()
    for i in range(100):
        lt._failures[f"10.0.0.{i}|user{i}"] = [now - lt.WINDOW_SECONDS - 1]

    lt.record_failure("10.0.0.1|baru")

    assert len(lt._failures) <= 2
    assert "10.0.0.1|baru" in lt._failures
