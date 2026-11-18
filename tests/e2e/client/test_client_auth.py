def test_identify_dengan_kunci_benar(h):
    r = h.identify()
    assert r.status_code == 200, r.text
    assert r.json().get("success") is True or r.json().get("valid") is True


def test_tanpa_kunci_401(h):
    r = h.post("/api/v1/public/client/status", {"ip_address": h.pc_id and "127.0.0.1"}, key="")
    assert r.status_code == 401
    assert "API Key" in r.json()["error"]


def test_kunci_salah_401_dan_tercatat_di_log(h):
    r = h.post("/api/v1/public/client/status", {"ip_address": "127.0.0.1"}, key="kunci-salah")
    assert r.status_code == 401
    assert "API_KEY_GAGAL" in h.log()


def test_bearer_tidak_diterima(h):
    r = h.post(
        "/api/v1/public/client/status",
        {"ip_address": "127.0.0.1"},
        key="",
        headers={"Authorization": f"Bearer {h.key}"},
    )
    assert r.status_code == 401


def test_pc_tidak_dikenal_tetap_200_kosong(h):
    r = h.post("/api/v1/public/client/status", {"ip_address": "10.10.9.9", "mac_address": "AA:BB:CC:DD:EE:FF"})
    assert r.status_code == 200
    assert r.json()["status"] == "kosong"
    assert r.json()["message"] == "PC tidak dikenal"


def test_mac_case_insensitive(h):
    r = h.post(
        "/api/v1/public/client/identify",
        {"ip_address": "127.0.0.1", "mac_address": "02:00:00:00:00:99", "hostname": "PC-C1"},
    )
    assert r.status_code == 200, r.text


def test_mac_beda_ditolak(h):
    r = h.post(
        "/api/v1/public/client/status",
        {"ip_address": "127.0.0.1", "mac_address": "02:00:00:00:00:AA"},
    )
    assert r.status_code == 400
    assert "MAC" in r.json()["error"]
