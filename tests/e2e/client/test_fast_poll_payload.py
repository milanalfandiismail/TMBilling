"""Fast poll harus mengirim perintah JSON sebagai objek, bukan string."""

import json


def test_perintah_vnc_dikirim_sebagai_objek(h):
    h.db_exec("UPDATE pc SET aktif=1 WHERE id=90")
    h.kasir_post("/api/v1/kasir/vnc/client/90/start", {})
    r = h.post("/api/v1/public/client/fast_poll",
               {"ip_address": "127.0.0.1", "mac_address": "02:00:00:00:00:99"})
    assert r.status_code == 200, r.text
    cmd = r.json().get("command")
    assert isinstance(cmd, dict), cmd
    assert cmd.get("type") == "vnc_start", cmd
    assert cmd.get("vnc_password"), cmd
