from client_harness import png_bytes


def test_monitor_valid_200(h):
    r = h.post(
        "/api/v1/public/monitor",
        {"IpAddress": "127.0.0.1", "CpuUsage": 12.5, "CpuTemp": 44, "GpuTemp": 50, "RamUsage": 42,
         "TopProcesses": [{"name": "chrome.exe", "cpu": 3.1}]},
    )
    assert r.status_code == 200, r.text


def test_monitor_metrik_non_numerik_400(h):
    r = h.post("/api/v1/public/monitor", {"IpAddress": "127.0.0.1", "CpuUsage": "abc"})
    assert r.status_code == 400


def test_screenshot_png_tersimpan(h):
    h.seed_pc()
    r = h.post("/api/v1/public/monitor/screenshot/upload", None, raw=png_bytes(),
               headers={"Content-Type": "image/png"})
    assert r.status_code == 200, r.text
    assert (h.root / "instance" / "uploads" / "screenshots" / "PC-C1.png").exists()


def test_screenshot_bukan_gambar_400(h):
    h.seed_pc()
    before = (h.root / "instance" / "uploads" / "screenshots" / "PC-C1.png").stat().st_mtime
    r = h.post("/api/v1/public/monitor/screenshot/upload", None, raw=b"bukan gambar",
               headers={"Content-Type": "image/png"})
    assert r.status_code == 400
    assert (h.root / "instance" / "uploads" / "screenshots" / "PC-C1.png").stat().st_mtime == before


def test_screenshot_tanpa_kunci_401(h):
    r = h.post("/api/v1/public/monitor/screenshot/upload", None, key="", raw=png_bytes())
    assert r.status_code == 401
