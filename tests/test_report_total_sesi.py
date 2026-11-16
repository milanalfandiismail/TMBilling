from datetime import datetime

import pytest

from app import create_app, db
from app.models import Sesi
from app.repositories import SesiRepository


@pytest.fixture
def ctx():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        yield app


def test_sesi_admin_tidak_dihitung(ctx):
    with ctx.app_context():
        db.session.add_all([
            Sesi(tipe="guest", mulai_pada=datetime(2026, 1, 1, 10, 0), status="selesai"),
            Sesi(tipe="member", mulai_pada=datetime(2026, 1, 1, 11, 0), status="selesai"),
            Sesi(tipe="admin", mulai_pada=datetime(2026, 1, 1, 12, 0), status="selesai"),
        ])
        db.session.commit()

        assert SesiRepository.count_by_date("2026-01-01") == 2
        assert SesiRepository.count_by_date() == 2
