"""Sesi member harus tampil di dashboard dengan nama member dan sisa menit."""


def test_dashboard_menampilkan_member(h):
    h.db_exec("UPDATE pc SET grup_id=1 WHERE id=90")
    h.db_exec("DELETE FROM sesi WHERE pc_id=90")
    r = h.post("/api/v1/public/auth/login",
               {"ip_address": "127.0.0.1", "mac_address": "02:00:00:00:00:99",
                "username": "member1", "password": "pass123"})
    assert r.status_code == 200, r.text
    pcs = h.kasir_get("/api/v1/kasir/dashboard/pc").json()["pc_list"]
    d = [p for p in pcs if p["id"] == 90][0]["sesi_detail"]
    assert d["tipe"] == "member", d
    assert d["nama"].lower() != "guest", d
    assert d["sisa_menit"] > 0, d


def test_health_memuat_versi(h):
    body = h.get("/api/health").json()
    assert body["version"].count(".") == 2, body
