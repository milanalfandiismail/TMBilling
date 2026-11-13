from app.services import idempotency


def test_claim_once_then_reject():
    idempotency.reset()
    assert idempotency.claim("abc") is True
    assert idempotency.claim("abc") is False


def test_empty_key_never_blocks():
    idempotency.reset()
    assert idempotency.claim(None) is True
    assert idempotency.claim("") is True


def test_claim_expires(monkeypatch):
    idempotency.reset()
    now = {"t": 1000.0}
    monkeypatch.setattr(idempotency.time, "monotonic", lambda: now["t"])
    assert idempotency.claim("abc", ttl_seconds=10) is True
    now["t"] = 1005.0
    assert idempotency.claim("abc", ttl_seconds=10) is False
    now["t"] = 1011.0
    assert idempotency.claim("abc", ttl_seconds=10) is True
