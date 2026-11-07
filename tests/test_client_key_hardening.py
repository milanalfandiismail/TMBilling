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
