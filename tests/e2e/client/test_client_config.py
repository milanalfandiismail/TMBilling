def test_warnet_berisi_qris_dan_announcement(h):
    r = h.get("/api/v1/public/client/warnet")
    assert r.status_code == 200
    body = r.json()
    data = body.get("data", body)
    assert "qris_path" in data and "announcement" in data


def test_announcement_xss_disanitasi(h):
    h.db_exec("UPDATE settings SET value=? WHERE key='warnet_announcement'",
              ('<script>alert(1)</script><a href="javascript:alert(1)">x</a>',))
    body = h.get("/api/v1/public/client/warnet").json()
    ann = body.get("data", body)["announcement"]
    assert "<script" not in ann.lower() and "javascript:" not in ann.lower()


def test_fast_poll_200(h):
    h.seed_pc()
    r = h.post("/api/v1/public/client/fast_poll", {"ip_address": "127.0.0.1", "mac_address": "02:00:00:00:00:99"})
    assert r.status_code == 200
    assert "command" in r.json() or "success" in r.json()


def test_vnc_ready_dan_stopped(h):
    h.seed_pc()
    ready = h.post("/api/v1/public/client/vnc_ready", {"ip_address": "127.0.0.1", "mac_address": "02:00:00:00:00:99"})
    assert ready.status_code == 200, ready.text
    stopped = h.post("/api/v1/public/client/vnc_stopped", {"ip_address": "127.0.0.1", "mac_address": "02:00:00:00:00:99"})
    assert stopped.status_code == 200, stopped.text


def test_tanpa_kunci_semua_endpoint_401(h):
    for path in ("/api/v1/public/client/warnet", "/api/v1/public/client/status", "/api/v1/public/client/fast_poll"):
        r = h.post(path, {"ip_address": "127.0.0.1"}, key="") if path != "/api/v1/public/client/warnet" else h.get(path, key="")
        assert r.status_code == 401, path


def test_vnc_poll_alias_fast_poll(h):
    h.seed_pc()
    r = h.post("/api/v1/public/client/vnc_poll", {"ip_address": "127.0.0.1", "mac_address": "02:00:00:00:00:99"})
    assert r.status_code == 200
