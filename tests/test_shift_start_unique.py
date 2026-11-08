import pytest
from sqlalchemy.exc import IntegrityError
from app import create_app, db
from app.models import User, ShiftRecord
from app.services.shift.shift_service import ShiftService


def _app():
    return create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
    })


def test_database_menolak_dua_shift_aktif():
    app = _app()
    with app.app_context():
        db.create_all()
        kasir = User(username="kasir_shift_a", role="kasir")
        kasir.set_password("pass123")
        db.session.add(kasir)
        db.session.commit()

        db.session.add(ShiftRecord(kasir_id=kasir.id, modal_awal=0, status="AKTIF"))
        db.session.commit()

        db.session.add(ShiftRecord(kasir_id=kasir.id, modal_awal=0, status="AKTIF"))
        with pytest.raises(IntegrityError):
            db.session.commit()
        db.session.rollback()


def test_start_shift_mengubah_integrity_error_jadi_value_error(monkeypatch):
    app = _app()
    with app.app_context():
        db.create_all()
        kasir = User(username="kasir_shift_b", role="kasir")
        kasir.set_password("pass123")
        db.session.add(kasir)
        db.session.commit()

        def gagal_commit():
            raise IntegrityError("INSERT", {}, Exception("UNIQUE constraint failed: shift_record.status"))

        monkeypatch.setattr(db.session, "commit", gagal_commit)

        with pytest.raises(ValueError, match="masih ada shift aktif"):
            ShiftService.start_shift("kasir_shift_b", modal_awal=0, operator="kasir_shift_b")

        db.session.rollback()
