from app.services.auth import login_throttle


def test_banyak_username_dari_satu_ip_terblokir():
    ip = "10.99.0.1"
    for i in range(login_throttle.MAX_FAILURES_PER_IP):
        login_throttle.fail(ip, f"user{i}")
    assert login_throttle.check(ip, "user-baru") is True
