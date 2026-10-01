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
