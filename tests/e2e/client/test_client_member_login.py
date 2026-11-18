"""Login klien PC: member membuka sesi billing, kasir membuka mode admin."""


def _member(h):
    h.db_exec("DELETE FROM sesi WHERE pc_id=90 OR member_id IS NOT NULL")
    return h.db("SELECT grup_id FROM member WHERE username='member1'")


def test_member_login_membuka_sesi(h):
    _member(h)
    h.db_exec("UPDATE pc SET grup_id=1 WHERE id=90")
    r = h.post("/api/v1/public/auth/login",
               {"ip_address": "127.0.0.1", "mac_address": "02:00:00:00:00:99",
                "username": "member1", "password": "pass123"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["is_member"] is True and body["pc_kode"] == "PC-C1", body
    assert body["waktu_tersimpan"] > 0, body
    row = h.db("SELECT tipe,status,member_id FROM sesi WHERE pc_id=90 ORDER BY id DESC LIMIT 1")
    assert row[0] == "member" and row[1] == "aktif" and row[2] is not None, row


def test_member_login_password_salah(h):
    _member(h)
    r = h.post("/api/v1/public/auth/login",
               {"ip_address": "127.0.0.1", "mac_address": "02:00:00:00:00:99",
                "username": "member1", "password": "salah"})
    assert r.status_code == 401, r.text


def test_login_pc_tidak_dikenal(h):
    r = h.post("/api/v1/public/auth/login",
               {"ip_address": "10.9.9.9", "mac_address": "02:00:00:00:00:AA",
                "username": "member1", "password": "pass123"})
    assert r.status_code == 404, r.text


def test_admin_login_membuka_mode_admin(h):
    _member(h)
    r = h.post("/api/v1/public/auth/login",
               {"ip_address": "127.0.0.1", "mac_address": "02:00:00:00:00:99",
                "username": "admin", "password": "admin123"})
    assert r.status_code == 200, r.text
    assert r.json()["is_member"] is False, r.text
    assert h.db("SELECT is_admin_mode FROM pc WHERE id=90") in (1, True)
