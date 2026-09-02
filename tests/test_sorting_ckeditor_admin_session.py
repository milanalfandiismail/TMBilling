import pytest
from app import create_app, db
from app.utils.helpers import sanitize_html
from app.models import PC, Sesi, User, Settings, Grup
from app.services import SettingsService, PCService, ClientService, SesiService


@pytest.fixture
def app_context():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["WTF_CSRF_ENABLED"] = False
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


def test_sanitize_html_xss_protection():
    # 1. Script injection
    dirty = '<script>alert("XSS")</script><p>Halo <strong>Dunia</strong></p>'
    cleaned = sanitize_html(dirty)
    assert "<script>" not in cleaned
    assert "alert" not in cleaned
    assert "<p>Halo <strong>Dunia</strong></p>" in cleaned

    # 2. Inline event handler injection
    dirty_event = '<p onclick="stealCookies()">Klik <a href="javascript:alert(1)">Saya</a></p>'
    cleaned_event = sanitize_html(dirty_event)
    assert "onclick" not in cleaned_event
    assert "javascript:" not in cleaned_event
    assert "Klik" in cleaned_event

    # 3. Iframe and Object tags
    dirty_frame = '<iframe src="https://evil.com"></iframe><object data="evil.swf"></object><p>Aman</p>'
    cleaned_frame = sanitize_html(dirty_frame)
    assert "<iframe" not in cleaned_frame
    assert "<object" not in cleaned_frame
    assert "<p>Aman</p>" in cleaned_frame

    # 4. Safe CKEditor rich tags
    ck_html = '<h2>Aturan</h2><ul><li>Poin 1</li><li><strong>Poin 2</strong></li></ul><blockquote>Penting</blockquote>'
    assert sanitize_html(ck_html) == ck_html


def test_warnet_announcement_default_is_empty(app_context):
    # Ensure default is empty string, no hardcoded rules
    val = SettingsService.get("warnet_announcement", "")
    assert val == ""


def test_pc_admin_session_remote_logout(app_context):
    grup = Grup(nama="reguler")
    db.session.add(grup)
    db.session.commit()

    # Setup a PC
    pc = PC(kode="PC-TEST-ADMIN", ip_address="192.168.1.99", mac_address="00:11:22:33:44:55", aktif=True, grup_id=grup.id)
    db.session.add(pc)
    db.session.commit()

    # Simulate Admin Login
    pc.is_admin_mode = True
    sesi = SesiService.buka_admin(pc.id, "token-admin-test-123", admin_nama="Admin Utama")
    db.session.commit()

    assert pc.is_admin_mode is True
    assert sesi.status == "aktif"
    assert sesi.tipe == "admin"

    # Reset admin mode from Kasir
    PCService.reset_admin_mode(pc.id, operator="kasir")
    assert pc.is_admin_mode is False
    assert sesi.status == "selesai"

    # Simulate Client Heartbeat when in admin role after server reset
    resp = ClientService.get_status(
        ip_address=pc.ip_address,
        mac_address=pc.mac_address,
        role="admin"
    )
    assert resp.get("command") == "lock"
    assert resp.get("status") == "kosong"

    # Simulate Client Heartbeat when in emergency role after server reset
    resp_emergency = ClientService.get_status(
        ip_address=pc.ip_address,
        mac_address=pc.mac_address,
        role="emergency"
    )
    assert resp_emergency.get("command") == "lock"
    assert resp_emergency.get("status") == "kosong"
