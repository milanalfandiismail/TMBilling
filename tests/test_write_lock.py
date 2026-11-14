def test_akuisisi_lambat_dicatat(monkeypatch):
    from app.services import write_lock as module

    waktu = iter([0.0, 1.5])
    monkeypatch.setattr(module.time, "monotonic", lambda: next(waktu))
    dicatat = []
    monkeypatch.setattr("app.utils.logger.write_log", lambda aksi, detail, **kw: dicatat.append(aksi))

    with module.WRITE_LOCK:
        pass

    assert dicatat == ["WRITE_LOCK_SLOW"]


def test_akuisisi_cepat_tidak_dicatat(monkeypatch):
    from app.services import write_lock as module

    waktu = iter([0.0, 0.1])
    monkeypatch.setattr(module.time, "monotonic", lambda: next(waktu))
    dicatat = []
    monkeypatch.setattr("app.utils.logger.write_log", lambda aksi, detail, **kw: dicatat.append(aksi))

    with module.WRITE_LOCK:
        pass

    assert dicatat == []


def test_reentrant_dan_exception_tetap_dilepas():
    from app.services.write_lock import WRITE_LOCK

    with WRITE_LOCK:
        with WRITE_LOCK:
            pass
    try:
        with WRITE_LOCK:
            raise RuntimeError("x")
    except RuntimeError:
        pass
    assert WRITE_LOCK.acquire(blocking=False) is True
    WRITE_LOCK.release()
