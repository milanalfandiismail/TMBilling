"""Restart/shutdown harus diantrekan ke antrean reguler yang dibaca aplikasi Tauri."""


def _poll(h, path):
    return h.post(path, {"ip_address": "127.0.0.1",
                         "mac_address": "02:00:00:00:00:99"}).json()


def test_restart_ke_antrean_reguler(h):
    h.db_exec("UPDATE pc SET aktif=1 WHERE id=90")
    r = h.kasir_post("/api/v1/kasir/monitor/remote/90/restart", {})
    assert r.status_code == 200, r.text
    st = _poll(h, "/api/v1/public/client/status")
    assert st.get("command") == "restart", st
    assert _poll(h, "/api/v1/public/client/fast_poll").get("command") is None


def test_shutdown_ke_antrean_reguler(h):
    h.db_exec("UPDATE pc SET aktif=1 WHERE id=90")
    r = h.kasir_post("/api/v1/kasir/monitor/remote/90/shutdown", {})
    assert r.status_code == 200, r.text
    assert _poll(h, "/api/v1/public/client/status").get("command") == "shutdown"


def test_batch_shutdown_ke_antrean_reguler(h):
    h.db_exec("UPDATE pc SET aktif=1 WHERE id=90")
    h.kasir_post("/api/v1/kasir/monitor/remote/batch",
                 {"pc_ids": [90], "action": "shutdown"})
    assert _poll(h, "/api/v1/public/client/status").get("command") == "shutdown"
