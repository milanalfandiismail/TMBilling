from datetime import datetime

import pytest

from app import create_app
from app.models import db, ShiftRecord, User
from app.services.shift.shift_service import ShiftService


@pytest.fixture
def app_ctx(tmp_path):
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path/'shift.db'}",
    })
    with app.app_context():
        db.create_all()
        yield
        db.session.remove()
        db.drop_all()


def test_shift_mulai_dini_hari_lokal_masuk_filter(app_ctx):
    admin = User.query.filter_by(username="admin").first()
    shift = ShiftRecord(
        kasir_id=admin.id,
        waktu_mulai=datetime(2026, 11, 7, 17, 0),  # 2026-11-08 01:00 WITA
        waktu_selesai=datetime(2026, 11, 8, 2, 0),
        status="SELESAI",
    )
    db.session.add(shift)
    db.session.commit()

    result = ShiftService.get_shift_history(tanggal_mulai="2026-11-08", tanggal_selesai="2026-11-08")
    assert [s["id"] for s in result["data"]] == [shift.id]
