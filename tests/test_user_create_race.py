import pytest
from app import create_app, db
from app.repositories import UserRepository
from app.services.user.user_service import UserService


@pytest.fixture
def ctx():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        yield


def test_username_duplikat_menjadi_value_error(ctx, monkeypatch):
    monkeypatch.setattr(UserRepository, "find_by_username", staticmethod(lambda username: None))

    UserService.create_user({"username": "race", "password": "pass123", "role": "kasir"})

    with pytest.raises(ValueError, match="Username sudah terdaftar"):
        UserService.create_user({"username": "race", "password": "pass123", "role": "kasir"})
