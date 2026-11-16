import app as app_module
from app import create_app


def test_spesifikasi_memakai_cache_lima_detik(monkeypatch):
    app = create_app(
        {"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"}
    )
    calls = []
    monkeypatch.setattr(
        app_module, "render_template", lambda *a, **k: calls.append(1) or "page"
    )
    with app.app_context():
        assert app_module._render_public_specs_page() == "page"
        assert app_module._render_public_specs_page() == "page"
    assert len(calls) == 1
