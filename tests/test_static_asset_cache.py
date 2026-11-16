from app import create_app


def _client():
    app = create_app({
        "TESTING": True, "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "SECRET_KEY": "test-static-cache",
    })
    return app.test_client()


def test_js_asset_gets_one_year_immutable_cache():
    res = _client().get("/static/js/kasir/core/api.js")
    assert res.status_code == 200
    cache = res.headers.get("Cache-Control", "")
    assert "max-age=31536000" in cache
    assert "immutable" in cache


def test_screenshot_upload_is_not_long_cached():
    res = _client().get("/static/uploads/screenshots/does-not-exist.png")
    assert "max-age=31536000" not in res.headers.get("Cache-Control", "")
