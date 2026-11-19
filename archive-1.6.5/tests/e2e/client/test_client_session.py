def test_status_sesi_aktif(h):
    h.seed_pc()
    h.seed_sesi(60)
    d = h.status().json()
    assert d["status"] == "aktif"
    assert d["pc_kode"] == "PC-C1"
    assert d["sisa_waktu"] > 0


def test_heartbeat_ditahan_30_detik(h):
    h.seed_pc()
    h.seed_sesi(60)
    h.db_exec("UPDATE sesi SET last_sync=datetime('now','-10 seconds') WHERE id=900")
    before = h.db("SELECT last_sync FROM sesi WHERE id=900")
    h.status()
    assert h.db("SELECT last_sync FROM sesi WHERE id=900") == before
    h.db_exec("UPDATE sesi SET last_sync=datetime('now','-40 seconds') WHERE id=900")
    h.status()
    assert h.db("SELECT last_sync FROM sesi WHERE id=900") != before


def test_pc_arsip_tidak_melanjutkan_sesi(h):
    h.seed_pc(aktif=0)
    assert h.status().json()["status"] == "kosong"
    h.seed_pc(aktif=1)


def test_selesai_menutup_sesi(h):
    h.seed_pc()
    h.seed_sesi(60)
    r = h.post("/api/v1/public/client/selesai", {"ip_address": "127.0.0.1", "mac_address": "02:00:00:00:00:99"})
    assert r.status_code == 200 and r.json()["success"] is True
    assert h.db("SELECT status FROM sesi WHERE id=900") == "selesai"


def test_admin_login_password_salah_400(h):
    h.seed_pc()
    r = h.post(
        "/api/v1/public/client/admin-login",
        {"ip_address": "127.0.0.1", "mac_address": "02:00:00:00:00:99", "username": "admin", "password": "salah"},
    )
    assert r.status_code == 400
    assert "Invalid admin credentials" in r.json()["error"]


def test_admin_login_benar_membuka_mode_admin(h):
    h.seed_pc()
    r = h.post(
        "/api/v1/public/client/admin-login",
        {"ip_address": "127.0.0.1", "mac_address": "02:00:00:00:00:99", "username": "admin", "password": "admin123"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["token_sesi"]
    assert h.db("SELECT is_admin_mode FROM pc WHERE id=?", (h.pc_id,)) == 1


def test_emergency_login_diotorisasi_ip_terdaftar(h):
    # Paritas Python: token ATAU request_ip == pc.ip_address; dari PC terdaftar jalur IP selalu sah.
    h.seed_pc()
    h.db_exec("UPDATE pc SET is_admin_mode=0 WHERE id=?", (h.pc_id,))
    r = h.post(
        "/api/v1/public/client/emergency-login",
        {"ip_address": "127.0.0.1", "mac_address": "02:00:00:00:00:99", "username": "admin", "token": "salah"},
    )
    assert r.status_code == 200, r.text
    assert "EMERGENCY_LOGIN" in h.log()


def test_emergency_login_token_benar(h):
    h.seed_pc()
    r = h.post(
        "/api/v1/public/client/emergency-login",
        {"ip_address": "127.0.0.1", "mac_address": "02:00:00:00:00:99", "username": "admin", "token": "e2e-emergency-token"},
    )
    assert r.status_code == 200, r.text
    assert h.db("SELECT is_admin_mode FROM pc WHERE id=?", (h.pc_id,)) == 1


def test_afk_lock_dan_unlock(h):
    h.seed_pc()
    h.seed_sesi(60)
    h.db_exec("UPDATE sesi SET is_afk=0 WHERE id=900")
    r = h.post("/api/v1/public/client/afk-lock", {"ip_address": "127.0.0.1", "mac_address": "02:00:00:00:00:99", "pin": "1234"})
    assert r.status_code == 200, r.text
    assert h.db("SELECT is_afk FROM sesi WHERE id=900") == 1
    salah = h.post("/api/v1/public/client/afk-unlock", {"ip_address": "127.0.0.1", "mac_address": "02:00:00:00:00:99", "credential": "9999"})
    assert salah.status_code == 401
    benar = h.post("/api/v1/public/client/afk-unlock", {"ip_address": "127.0.0.1", "mac_address": "02:00:00:00:00:99", "credential": "1234"})
    assert benar.status_code == 200, benar.text
    assert h.db("SELECT is_afk FROM sesi WHERE id=900") == 0
