import time
from app.services.vnc.vnc_service import VNCClientProxyService


def test_cleanup_closes_idle_proxy(monkeypatch):
    stopped = []
    monkeypatch.setattr(VNCClientProxyService, "stop_proxy", classmethod(lambda cls, pc_id: (stopped.append(pc_id), (True, ""))[1]))
    monkeypatch.setattr("app.services.cache.OnlineStatusStore.is_online", staticmethod(lambda *a, **k: True))
    VNCClientProxyService._active_proxies = {7: {"port": 8081, "client_ip": "10.0.0.1", "token": "x", "started_at": time.time() - 700}}
    assert VNCClientProxyService.cleanup_stale_proxies(600) == 1
    assert stopped == [7]
