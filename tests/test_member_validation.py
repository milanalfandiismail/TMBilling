# tests/test_member_validation.py
import pytest
from app import create_app
from app.models import db, Member, Grup
from app.services.member.member_service import MemberService


@pytest.fixture
def app_context():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.create_all()
        # Seed grup reguler
        g = Grup(nama="reguler", keterangan="Reguler Zone", warna="#888888")
        db.session.add(g)
        db.session.commit()
        yield app
        db.session.remove()
        db.drop_all()


def test_create_member_valid(app_context):
    data = {
        "username": "member_pro",
        "password": "pin1",
        "nama_lengkap": "Pro Player",
        "no_hp": "081234567890",
        "email": "pro@gmail.com",
        "grup": "reguler"
    }
    member = MemberService.create(data)
    assert member.username == "member_pro"
    assert member.nama_lengkap == "Pro Player"
    assert member.no_hp == "081234567890"


def test_create_member_invalid_username_length(app_context):
    with pytest.raises(ValueError, match="Username minimal 3 karakter"):
        MemberService.create({"username": "ab", "password": "1234"})

    with pytest.raises(ValueError, match="Username maksimal 30 karakter"):
        MemberService.create({"username": "m" * 31, "password": "1234"})


def test_create_member_invalid_username_chars(app_context):
    with pytest.raises(ValueError, match="Username hanya boleh berisi"):
        MemberService.create({"username": "Member Pro!", "password": "1234"})


def test_create_member_invalid_password(app_context):
    with pytest.raises(ValueError, match="Password minimal 4 karakter"):
        MemberService.create({"username": "member01", "password": "12"})

    with pytest.raises(ValueError, match="Password maksimal 16 karakter"):
        MemberService.create({"username": "member01", "password": "p" * 17})


def test_create_member_invalid_phone(app_context):
    with pytest.raises(ValueError, match="Nomor HP harus"):
        MemberService.create({"username": "member01", "password": "1234", "no_hp": "123"})


def test_create_member_invalid_email(app_context):
    with pytest.raises(ValueError, match="Format alamat email tidak valid"):
        MemberService.create({"username": "member01", "password": "1234", "email": "bukan-email"})


def test_update_member_validation(app_context):
    m = MemberService.create({"username": "member01", "password": "1234", "grup": "reguler"})

    # Invalid update password
    with pytest.raises(ValueError, match="Password minimal 4 karakter"):
        MemberService.update(m.id, {"password": "12"})

    # Invalid update phone
    with pytest.raises(ValueError, match="Nomor HP harus"):
        MemberService.update(m.id, {"no_hp": "invalid-phone"})

    # Valid update
    updated = MemberService.update(m.id, {"nama_lengkap": "New Name", "no_hp": "089876543210"})
    assert updated.nama_lengkap == "New Name"
    assert updated.no_hp == "089876543210"
