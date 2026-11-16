import pytest
from app import create_app, db
from app.models import User


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
