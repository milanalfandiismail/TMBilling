import pytest
import time
from app.services.vnc.vnc_service import VNCClientProxyService

def test_port_allocation_within_range():
    port = VNCClientProxyService.allocate_port()
    assert port is not None
    assert VNCClientProxyService.PORT_RANGE_START <= port <= VNCClientProxyService.PORT_RANGE_END

def test_readiness_flag_signaling():
    pc_id = 9991
    success, err = VNCClientProxyService.wait_vnc_ready(pc_id, timeout=0.1)
    assert success is False
    assert err is not None
    
    VNCClientProxyService.set_vnc_ready(pc_id, True)
    success, err = VNCClientProxyService.wait_vnc_ready(pc_id, timeout=0.5)
    assert success is True
    assert err is None
    
    VNCClientProxyService.set_vnc_ready(pc_id, False, "Gagal koneksi")
    success, err = VNCClientProxyService.wait_vnc_ready(pc_id, timeout=0.1)
    assert success is False
    assert err == "Gagal koneksi"

def test_proxy_lifecycle_tracking():
    pc_id = 9992
    VNCClientProxyService._active_proxies[pc_id] = {
        "port": 8095,
        "client_ip": "192.168.1.50",
        "process": None,
        "started_at": time.time()
    }
    
    proxy = VNCClientProxyService.get_proxy(pc_id)
    assert proxy is not None
    assert proxy["port"] == 8095
    assert proxy["client_ip"] == "192.168.1.50"
    
    success, msg = VNCClientProxyService.stop_proxy(pc_id)
    assert success is True
    assert VNCClientProxyService.get_proxy(pc_id) is None
