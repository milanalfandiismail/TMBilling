import pytest
from app import create_app, db
from app.models import Settings
from app.services.settings.settings_service import SettingsService

@pytest.fixture
def app_ctx():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

def test_vnc_password_auto_generates_and_persists(app_ctx):
    """Memastikan jika vnc_password kosong, sistem membuat password acak unik dan menyimpannya di DB."""
    # Pastikan DB kosong dari setting vnc_password
    pwd1 = SettingsService.get_or_create_vnc_password()
    assert pwd1 != "tmbilling123"
    assert len(pwd1) >= 8

    # Pemanggilan kedua harus mengembalikan password yang sama (persisten)
    pwd2 = SettingsService.get_or_create_vnc_password()
    assert pwd2 == pwd1

    # Verifikasi langsung ke database
    stored = Settings.query.filter_by(key="vnc_password").first()
    assert stored is not None
    assert stored.value == pwd1
