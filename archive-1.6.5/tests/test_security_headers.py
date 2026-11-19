import pytest
from app import create_app


@pytest.fixture
def client():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    return app.test_client()


def test_header_keamanan_dikirim_di_html_dan_api(client):
    for path in ("/kasir/login", "/api/health"):
        res = client.get(path)
        assert res.headers.get("X-Frame-Options") == "SAMEORIGIN", path
        assert res.headers.get("X-Content-Type-Options") == "nosniff", path
        assert res.headers.get("Referrer-Policy") == "same-origin", path


def test_header_tidak_merusak_cache_static(client):
    res = client.get("/static/js/kasir/core/utils.js")
    assert res.headers.get("X-Content-Type-Options") == "nosniff"
    assert res.headers.get("Cache-Control") == "public, max-age=31536000, immutable"
