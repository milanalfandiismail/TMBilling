"""Screenshot harus muncul di command respons /client/status (antrean reguler)."""


def test_screenshot_masuk_antrean_status(h):
    h.seed_sesi(30)
    r = h.kasir_post("/api/v1/kasir/monitor/screenshot/trigger/90", {})
    assert r.status_code == 200, r.text

    def status():
        return h.post("/api/v1/public/client/status", {"ip_address": "127.0.0.1", "mac_address": "02:00:00:00:00:99"}).json()

    pertama = status()
    assert pertama.get("command") == "screenshot", pertama
    kedua = status()
    assert kedua.get("command") in (None, ""), kedua
