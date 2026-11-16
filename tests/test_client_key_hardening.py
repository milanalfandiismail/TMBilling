import inspect
from app import TMBillingCSRFProtect
from app.middleware import ip_whitelist_middleware


def test_bearer_compare_memakai_compare_digest():
    source = inspect.getsource(TMBillingCSRFProtect.protect)
    assert "hmac.compare_digest" in source


def test_token_whitelist_memakai_compare_digest():
    source = inspect.getsource(ip_whitelist_middleware)
    assert "hmac.compare_digest" in source


def test_settings_get_tidak_memakai_api_key_default_hardcoded():
    from app.routes.settings import general_routes
    assert "TM2026QWERTY-api-key" not in inspect.getsource(general_routes.get_all_settings)


def test_uninstall_token_menolak_ip_tidak_terdaftar():
    from app import create_app
    from app.models import db
    app = create_app({"TESTING": True, "WTF_CSRF_ENABLED": False,
                      "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
                      "CLIENT_API_KEY": "kunci-uji"})
    client = app.test_client()
    with app.app_context():
        db.create_all()
    res = client.get("/api/v1/kasir/settings/uninstall-token/client",
                     headers={"X-Client-Key": "kunci-uji"},
                     environ_overrides={"REMOTE_ADDR": "10.9.9.9"})
    assert res.status_code == 403


def test_body_ip_tidak_boleh_mengaku_pc_lain():
    from app import create_app
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "CLIENT_API_KEY": "kunci-uji",
    })
    client = app.test_client()
    res = client.post(
        "/api/v1/public/client/status",
        json={"ip_address": "192.168.1.11", "mac_address": ""},
        headers={"X-Client-Key": "kunci-uji"},
        environ_overrides={"REMOTE_ADDR": "192.168.1.12"},
    )

    assert res.status_code == 400
    assert "tidak cocok" in res.get_json()["error"]
