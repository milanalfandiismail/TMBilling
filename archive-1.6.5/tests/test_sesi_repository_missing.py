from app import create_app
from app.models import db
from app.repositories.sesi.sesi_repository import SesiRepository


def test_get_by_id_mengembalikan_none():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        assert SesiRepository.get_by_id(999999) is None
