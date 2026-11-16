import pytest
from flask import Flask
from app import create_app
from app.services.ip_whitelist.ip_whitelist_service import IpWhitelistService


@pytest.fixture
def app_client():
    app = create_app()
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False

    with app.test_client() as client:
        yield app, client


def test_extract_client_ip_direct_lan_ignores_spoofed_headers():
    headers = {"X-Forwarded-For": "127.0.0.1, 10.0.0.1", "CF-Connecting-IP": "127.0.0.1"}
    remote_addr = "192.168.1.55"

    # Karena remote_addr adalah LAN dan bukan trusted proxy, header spoofed harus diabaikan
    extracted = IpWhitelistService.extract_client_ip(headers=headers, remote_addr=remote_addr)
    assert extracted == "192.168.1.55"


def test_extract_client_ip_from_trusted_proxy():
    headers = {"X-Forwarded-For": "203.0.113.195, 10.0.0.1"}
    remote_addr = "127.0.0.1"

    # Jika request melalui reverse proxy loopback lokal, X-Forwarded-For dipercayai
    extracted = IpWhitelistService.extract_client_ip(headers=headers, remote_addr=remote_addr)
    assert extracted == "203.0.113.195"


def test_extract_client_ip_cloudflare_connecting_ip():
    headers = {"CF-Connecting-IP": "198.51.100.22", "X-Forwarded-For": "198.51.100.22"}
    remote_addr = "127.0.0.1"

    extracted = IpWhitelistService.extract_client_ip(headers=headers, remote_addr=remote_addr)
    assert extracted == "198.51.100.22"


def test_middleware_blocks_spoofed_x_forwarded_for_from_lan(app_client):
    app, client = app_client

    with app.app_context():
        # Set whitelist aktif dan hanya izinkan 127.0.0.1
        IpWhitelistService.set_enabled(True)
        IpWhitelistService._save_entries([{"ip": "127.0.0.1", "label": "Localhost"}])

    try:
        # Request datang dari LAN (192.168.1.99) tapi mengirim header X-Forwarded-For: 127.0.0.1
        response = client.get(
            "/api/v1/kasir/menu/",
            environ_base={"REMOTE_ADDR": "192.168.1.99"},
            headers={"X-Forwarded-For": "127.0.0.1"},
        )
        # Harus diblokir 403 Forbidden
        assert response.status_code == 403
    finally:
        with app.app_context():
            IpWhitelistService.set_enabled(False)

@pytest.fixture
def whitelist_app(tmp_path):
    from app import db
    from app.models import User

    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'wl.db'}",
        "SECRET_KEY": "test-whitelist-role",
    })
    with app.app_context():
        db.create_all()
        admin = User(username="adminwl", nama_lengkap="Admin", role="admin", aktif=True)
        kasir = User(username="kasirwl", nama_lengkap="Kasir", role="kasir", aktif=True)
        admin.set_password("x")
        kasir.set_password("x")
        db.session.add_all([admin, kasir])
        db.session.commit()
        IpWhitelistService.set_enabled(True)
        IpWhitelistService._save_entries([{"ip": "10.0.0.1", "label": "Jaringan"}])
        yield app, admin, kasir
        IpWhitelistService.set_enabled(False)
        db.session.remove()
        db.drop_all()


def _login(app, user, session_role):
    client = app.test_client()
    with client.session_transaction() as sess:
        sess["kasir_id"] = user.id
        sess["kasir_username"] = user.username
        sess["kasir_role"] = session_role
    return client


def _unlisted(client):
    return client.get("/api/v1/kasir/report/kasir-list",
                      environ_base={"REMOTE_ADDR": "192.168.1.50"})


def test_active_admin_still_bypasses_whitelist(whitelist_app):
    app, admin, _kasir = whitelist_app
    assert _unlisted(_login(app, admin, "admin")).status_code == 200


def test_demoted_admin_session_cannot_bypass_whitelist(whitelist_app):
    app, admin, _kasir = whitelist_app
    from app import db
    admin.role = "kasir"
    db.session.commit()
    assert _unlisted(_login(app, admin, "admin")).status_code == 403


def test_inactive_admin_session_cannot_bypass_whitelist(whitelist_app):
    app, admin, _kasir = whitelist_app
    from app import db
    admin.aktif = False
    db.session.commit()
    assert _unlisted(_login(app, admin, "admin")).status_code == 403


def test_cashier_session_still_requires_allowed_ip(whitelist_app):
    app, _admin, kasir = whitelist_app
    assert _unlisted(_login(app, kasir, "kasir")).status_code == 403


def test_valid_whitelist_token_session_still_bypasses(whitelist_app):
    app, _admin, kasir = whitelist_app
    client = _login(app, kasir, "kasir")
    with client.session_transaction() as sess:
        sess["ip_wh_authenticated"] = True
        sess["ip_wh_token_version"] = IpWhitelistService.get_token_version()
    assert _unlisted(client).status_code == 200


def test_disabled_whitelist_still_allows_cashier(whitelist_app):
    app, _admin, kasir = whitelist_app
    IpWhitelistService.set_enabled(False)
    assert _unlisted(_login(app, kasir, "kasir")).status_code == 200
