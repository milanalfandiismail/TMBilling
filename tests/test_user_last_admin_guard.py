import pytest
from app import create_app, db
from app.models import User
from app.services.user.user_service import UserService


def _app():
    return create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
    })


def test_admin_terakhir_tidak_boleh_diturunkan():
    app = _app()
    with app.app_context():
        db.create_all()
        User.query.delete()
        db.session.commit()
        admin = User(username="admin_satu", nama_lengkap="Admin", role="admin")
        admin.set_password("pass123")
        db.session.add(admin)
        db.session.commit()

        with pytest.raises(ValueError, match="satu-satunya Admin"):
            UserService.update_user(admin.id, {"role": "kasir"}, operator="admin_satu")

        db.session.expire_all()
        assert db.session.get(User, admin.id).role == "admin"


def test_admin_terakhir_tidak_boleh_dinonaktifkan():
    app = _app()
    with app.app_context():
        db.create_all()
        User.query.delete()
        db.session.commit()
        admin = User(username="admin_dua", nama_lengkap="Admin", role="admin")
        admin.set_password("pass123")
        db.session.add(admin)
        db.session.commit()

        with pytest.raises(ValueError, match="satu-satunya Admin"):
            UserService.update_user(admin.id, {"aktif": False}, operator="admin_dua")

        db.session.expire_all()
        assert db.session.get(User, admin.id).aktif is True


def test_admin_kedua_masih_boleh_diturunkan():
    app = _app()
    with app.app_context():
        db.create_all()
        User.query.delete()
        db.session.commit()
        for name in ("admin_a", "admin_b"):
            user = User(username=name, nama_lengkap="Admin", role="admin")
            user.set_password("pass123")
            db.session.add(user)
        db.session.commit()

        UserService.update_user(
            User.query.filter_by(username="admin_b").first().id,
            {"role": "kasir"},
            operator="admin_a",
        )

        db.session.expire_all()
        assert User.query.filter_by(username="admin_b").first().role == "kasir"
