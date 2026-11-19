# tests/test_user_validation.py
import pytest
from app import create_app
from app.models import db, User
from app.services.user.user_service import UserService


@pytest.fixture
def app_context():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


def test_create_user_valid(app_context):
    data = {
        "username": "kasir_sore",
        "password": "password123",
        "nama_lengkap": "Kasir Sore",
        "role": "kasir"
    }
    user_dict = UserService.create_user(data)
    assert user_dict["username"] == "kasir_sore"
    assert user_dict["role"] == "kasir"


def test_create_user_invalid_username_length(app_context):
    with pytest.raises(ValueError, match="Username minimal 3 karakter"):
        UserService.create_user({"username": "ab", "password": "password123"})

    with pytest.raises(ValueError, match="Username maksimal 30 karakter"):
        UserService.create_user({"username": "a" * 31, "password": "password123"})


def test_create_user_invalid_username_chars(app_context):
    with pytest.raises(ValueError, match="Username hanya boleh berisi"):
        UserService.create_user({"username": "kasir sore", "password": "password123"})


def test_create_user_invalid_password(app_context):
    with pytest.raises(ValueError, match="Password minimal 6 karakter"):
        UserService.create_user({"username": "kasir01", "password": "123"})

    with pytest.raises(ValueError, match="Password maksimal 32 karakter"):
        UserService.create_user({"username": "kasir01", "password": "p" * 33})


def test_create_user_invalid_role(app_context):
    with pytest.raises(ValueError, match="Role harus 'admin' atau 'kasir'"):
        UserService.create_user({"username": "kasir01", "password": "password123", "role": "superman"})


def test_update_user_validation(app_context):
    u = UserService.create_user({"username": "kasir01", "password": "password123", "role": "kasir"})
    user_id = u["id"]

    # Invalid update username
    with pytest.raises(ValueError, match="Username minimal 3 karakter"):
        UserService.update_user(user_id, {"username": "k"})

    # Invalid update password
    with pytest.raises(ValueError, match="Password minimal 6 karakter"):
        UserService.update_user(user_id, {"password": "123"})

    # Valid update
    updated = UserService.update_user(user_id, {"nama_lengkap": "Kasir Hebat", "password": "newpassword123"})
    assert updated["nama_lengkap"] == "Kasir Hebat"


def test_create_and_update_user_kuota_benefit(app_context):
    # 1. Create kasir with kuota 600 menit (10 jam)
    data = {
        "username": "kasir_kuota",
        "password": "password123",
        "nama_lengkap": "Kasir Kuota Test",
        "role": "kasir",
        "kuota_main_bulanan": 600
    }
    user_dict = UserService.create_user(data)
    assert user_dict["kuota_main_bulanan"] == 600
    assert user_dict["sisa_kuota_menit"] == 600
    user_id = user_dict["id"]

    # 2. Update kuota to 1200 menit (20 jam)
    updated = UserService.update_user(user_id, {"kuota_main_bulanan": 1200})
    assert updated["kuota_main_bulanan"] == 1200
    assert updated["sisa_kuota_menit"] == 1200

    # 3. Create admin with kuota -> should be 0
    admin_data = {
        "username": "admin_kuota",
        "password": "password123",
        "role": "admin",
        "kuota_main_bulanan": 600
    }
    admin_dict = UserService.create_user(admin_data)
    assert admin_dict["kuota_main_bulanan"] == 0
    assert admin_dict["sisa_kuota_menit"] == 0

