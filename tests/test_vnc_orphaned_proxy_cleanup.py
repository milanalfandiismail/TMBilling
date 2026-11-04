import time
from app import create_app
from app.services.vnc.vnc_service import VNCClientProxyService
from app.services.cache import OnlineStatusStore
from app.utils.scheduler_tasks import run_cleanup_vnc_proxies


def test_vnc_cleanup_stale_proxies():
    """Memastikan cleanup_stale_proxies membersihkan proxy yang sudah idle/stale
    atau jika PC klien telah offline."""
    # Setup mock active proxies
    with VNCClientProxyService._proxies_lock:
        VNCClientProxyService._active_proxies.clear()
        # Proxy 1: Sangat lama (> 600 detik)
        VNCClientProxyService._active_proxies[101] = {
            "port": 8081,
            "client_ip": "192.168.1.101",
            "token": "client_101",
            "started_at": time.time() - 700
        }
        # Proxy 2: Masih baru tapi PC offline (tidak ada heartbeat)
        VNCClientProxyService._active_proxies[102] = {
            "port": 8081,
            "client_ip": "192.168.1.102",
            "token": "client_102",
            "started_at": time.time() - 30
        }
        # Proxy 3: Masih baru dan PC online
        VNCClientProxyService._active_proxies[103] = {
            "port": 8081,
            "client_ip": "192.168.1.103",
            "token": "client_103",
            "started_at": time.time() - 10
        }

    # Set PC 103 online
    OnlineStatusStore.mark_active(103)

    # Jalankan cleanup
    cleaned = VNCClientProxyService.cleanup_stale_proxies(max_idle_seconds=600)
    assert cleaned == 2  # 101 (timeout) and 102 (offline)

    # Sisa hanya 103
    with VNCClientProxyService._proxies_lock:
        assert 101 not in VNCClientProxyService._active_proxies
        assert 102 not in VNCClientProxyService._active_proxies
        assert 103 in VNCClientProxyService._active_proxies

    # Bersihkan 103
    VNCClientProxyService.stop_proxy(103)


def test_scheduler_run_cleanup_vnc_proxies():
    """Memastikan task scheduler run_cleanup_vnc_proxies dapat dijalankan dengan aman."""
    app = create_app()
    with VNCClientProxyService._proxies_lock:
        VNCClientProxyService._active_proxies.clear()
        VNCClientProxyService._active_proxies[999] = {
            "port": 8081,
            "client_ip": "192.168.1.99",
            "token": "client_999",
            "started_at": time.time() - 800
        }

    run_cleanup_vnc_proxies(app)

    with VNCClientProxyService._proxies_lock:
        assert 999 not in VNCClientProxyService._active_proxies
