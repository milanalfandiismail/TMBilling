import pytest
import time
from app.services.vnc.vnc_service import VNCClientProxyService

def test_port_allocation_within_range():
    port = VNCClientProxyService.allocate_port()
    assert port == 8081

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

def test_token_file_management(tmp_path):
    from app.services.vnc.vnc_service import VNCService
    token_file = str(tmp_path / "vnc_tokens.cfg")
    VNCService.TOKEN_FILE_PATH = token_file
    
    # 1. Pastikan token server terdaftar
    VNCService.ensure_default_tokens()
    with open(token_file, "r") as f:
        content = f.read()
    assert "server: 127.0.0.1:5900" in content

    # 2. Tambah token client
    VNCService.set_token("client_1", "192.168.1.101", 5900)
    with open(token_file, "r") as f:
        content = f.read()
    assert "client_1: 192.168.1.101:5900" in content

    # 3. Hapus token client
    VNCService.remove_token("client_1")
    with open(token_file, "r") as f:
        content = f.read()
    assert "client_1" not in content
    assert "server: 127.0.0.1:5900" in content
