# tests/test_gmaps_settings_integration.py
"""Test suite integrasi konfigurasi Google Maps dan render landing page publik."""

import pytest
from app import create_app
from app.services import SettingsService


@pytest.fixture
def client_with_admin():
    app = create_app()
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False

    with app.app_context():
        # Reset gmaps setting to empty before test
        SettingsService.set("warnet_gmaps", "")

    with app.test_client() as client:
        with client.session_transaction() as sess:
            sess["kasir_id"] = 1
            sess["kasir_role"] = "admin"
            sess["kasir_username"] = "admin"
        yield client

    with app.app_context():
        # Cleanup
        SettingsService.set("warnet_gmaps", "")


def test_gmaps_setting_crud_and_public_render(client_with_admin):
    """Memastikan alur CRUD setting warnet_gmaps dan conditional render di landing page."""
    # 1. Saat kosong, halaman publik tidak menampilkan seksi peta
    res_init = client_with_admin.get("/")
    assert res_init.status_code == 200
    assert b"Lokasi &amp; Rute Warnet" not in res_init.data
    assert b"id=\"landing-gmaps-section\"" not in res_init.data

    # 2. Simpan setting Google Maps embed via API
    test_embed = '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d12345!2d106.8!3d-6.2" width="600" height="450"></iframe>'
    res_put = client_with_admin.put(
        "/api/v1/kasir/settings/warnet_gmaps",
        json={"value": test_embed}
    )
    assert res_put.status_code == 200
    assert res_put.json["success"] is True

    # 3. GET setting via API
    res_get = client_with_admin.get("/api/v1/kasir/settings/warnet_gmaps")
    assert res_get.status_code == 200
    assert "https://www.google.com/maps/embed" in res_get.json["value"]

    # 4. Halaman publik sekarang me-render seksi peta
    res_public = client_with_admin.get("/")
    assert res_public.status_code == 200
    assert b"Lokasi &amp; Rute Warnet" in res_public.data or b"Lokasi & Rute Warnet" in res_public.data
    assert b"12345" in res_public.data

    # 5. Reset kembali ke string kosong -> seksi peta hilang lagi
    client_with_admin.put(
        "/api/v1/kasir/settings/warnet_gmaps",
        json={"value": ""}
    )
    res_reset = client_with_admin.get("/")
    assert res_reset.status_code == 200
    assert b"id=\"landing-gmaps-section\"" not in res_reset.data
