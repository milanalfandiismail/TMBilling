import pytest
from sqlalchemy.exc import IntegrityError
from app import create_app
from app.models import db, Grup, PC
from app.services.pc.pc_service import PCService


def test_create_batch_race_integrity_error_jadi_value_error(monkeypatch):
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        db.session.add(Grup(nama="reguler"))
        db.session.commit()

        def gagal():
            raise IntegrityError("INSERT", {}, Exception("UNIQUE constraint failed: pc.kode"))

        monkeypatch.setattr(db.session, "commit", gagal)

        with pytest.raises(ValueError, match="sudah dipakai"):
            PCService.create_batch({
                "prefix": "RACE",
                "start_num": 1,
                "end_num": 1,
                "ip_start": "10.10.10.1",
                "ip_end": "10.10.10.1",
                "grup": "reguler",
            })

        db.session.rollback()
        assert PC.query.filter(PC.kode.like("RACE%")).count() == 0
