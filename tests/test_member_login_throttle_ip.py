from app import create_app


def _client():
    app = create_app({"TESTING": True, "WTF_CSRF_ENABLED": False,
                      "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    return app.test_client()


def _attempt(client, ip, username):
    return client.post(
        "/member/login",
        json={"username": username, "password": "salah"},
        headers={"CF-Connecting-IP": ip},
    )


def test_throttle_mengikuti_ip_forwarded_bukan_socket():
    client = _client()
    for i in range(20):
        assert _attempt(client, "203.0.113.9", f"hantu{i}").status_code == 401
    assert _attempt(client, "203.0.113.9", "hantu20").status_code == 429
    assert _attempt(client, "203.0.113.10", "hantu0").status_code == 401
