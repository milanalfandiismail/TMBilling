import pytest
from app import create_app
from app.services.settings.settings_service import SettingsService


def test_csrf_rejects_invalid_bearer_token():
    """Memastikan header Authorization: Bearer palsu/invalid TIDAK membypass proteksi CSRF
    pada endpoint yang memerlukan proteksi CSRF (seperti rute kasir)."""
    app = create_app()
    app.config["WTF_CSRF_ENABLED"] = True

    with app.test_client() as client:
        # Kirim request POST ke endpoint kasir dengan Bearer palsu tanpa CSRF token
        response = client.post(
            "/api/v1/kasir/paket/",
            headers={"Authorization": "Bearer fake_malicious_token", "X-Requested-With": "XMLHttpRequest"},
            data={"nama": "Paket Hack", "durasi_menit": 60, "harga": 10000}
        )
        # Harusnya ditolak 400 Bad Request oleh CSRFProtect (CSRF token missing)
        assert response.status_code == 400
        html_or_json = response.get_data(as_text=True).lower()
        assert "csrf" in html_or_json


def test_csrf_accepts_valid_registered_client_api_key():
    """Memastikan header Authorization: Bearer dengan client_api_key yang valid
    berhasil dibebaskan dari kewajiban CSRF token."""
    app = create_app()
    app.config["WTF_CSRF_ENABLED"] = True

    with app.app_context():
        valid_key = SettingsService.get("client_api_key")
        if not valid_key:
            valid_key = "test_valid_client_api_key_12345"
            SettingsService.set("client_api_key", valid_key)

    with app.test_client() as client:
        # Kirim request POST dengan valid Bearer token
        response = client.post(
            "/api/v1/kasir/paket/",
            headers={"Authorization": f"Bearer {valid_key}", "X-Requested-With": "XMLHttpRequest"},
            data={"nama": "Paket Valid", "durasi_menit": 60, "harga": 10000}
        )
        # Status code TIDAK boleh 400 CSRF Error (bisa 401 jika belum login kasir, tapi bukan CSRF reject)
        html_or_json = response.get_data(as_text=True).lower()
        assert response.status_code != 400 or "csrf" not in html_or_json
