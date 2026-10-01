import pytest
from app import create_app, db
from app.models import User
from app.services.settings.settings_service import SettingsService


@pytest.fixture
def csrf_app():
    app = create_app()
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = True  # Aktifkan proteksi CSRF
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"

    with app.app_context():
        db.create_all()

        admin = User.query.filter_by(username="admin").first()
        if not admin:
            admin = User(username="admin", role="admin", aktif=True)
            admin.set_password("admin123")
            db.session.add(admin)
            db.session.commit()

        yield app

        db.session.remove()
        db.drop_all()


def test_shift_endpoint_rejects_session_post_without_csrf(csrf_app):
    client = csrf_app.test_client()

    # Login via session
    with client.session_transaction() as sess:
        sess["kasir_id"] = 1
        sess["kasir_role"] = "admin"
        sess["kasir_username"] = "admin"

    # Kirim POST ke shift endpoint tanpa CSRF token
    response = client.post("/api/v1/kasir/shift/start", json={"modal_awal": 50000})

    # Harus ditolak oleh CSRF protection (400 Bad Request)
    assert response.status_code == 400
    assert b"CSRF" in response.data or b"csrf" in response.data


def test_branch_endpoint_rejects_session_post_without_csrf(csrf_app):
    client = csrf_app.test_client()

    with client.session_transaction() as sess:
        sess["kasir_id"] = 1
        sess["kasir_role"] = "admin"
        sess["kasir_username"] = "admin"

    response = client.post("/api/v1/kasir/branch/add", json={"nama": "Cabang Baru", "url": "http://1.2.3.4"})

    assert response.status_code == 400
    assert b"CSRF" in response.data or b"csrf" in response.data


def test_bearer_token_exempt_from_csrf(csrf_app):
    client = csrf_app.test_client()

    with csrf_app.app_context():
        local_key = SettingsService.get_or_create_branch_api_key()

    # Request antar-cabang dengan Bearer token tidak mewajibkan CSRF token
    headers = {
        "Authorization": f"Bearer {local_key}",
        "X-Operator-Username": "remote_admin",
        "X-Origin-Branch-Name": "TM-Cabang-X",
    }
    response = client.get("/api/v1/kasir/branch/list", headers=headers)
    assert response.status_code == 200
