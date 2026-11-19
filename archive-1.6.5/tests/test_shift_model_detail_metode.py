# tests/test_shift_model_detail_metode.py
import pytest
import json
from app import create_app, db
from app.models import User, ShiftRecord

@pytest.fixture
def app_ctx():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.create_all()
        kasir = User(username="kasir_dt", role="kasir")
        kasir.set_password("pass123")
        db.session.add(kasir)
        db.session.commit()
        yield app, kasir
        db.session.remove()
        db.drop_all()

def test_shift_record_detail_metode_json(app_ctx):
    app, kasir = app_ctx
    detail_data = {
        "tunai": {"billing": 50000, "kantin": 20000, "refund": 0, "total": 70000},
        "non_tunai": [
            {"method": "QRIS", "billing": 30000, "kantin": 10000, "total": 40000},
            {"method": "Transfer Bank", "billing": 25000, "kantin": 0, "total": 25000}
        ],
        "total_non_tunai": 65000
    }
    shift = ShiftRecord(
        kasir_id=kasir.id,
        modal_awal=100000,
        status="SELESAI",
        detail_metode_json=json.dumps(detail_data)
    )
    db.session.add(shift)
    db.session.commit()

    saved = ShiftRecord.query.get(shift.id)
    assert saved.detail_metode_json is not None
    loaded = json.loads(saved.detail_metode_json)
    assert loaded["tunai"]["total"] == 70000
    assert len(loaded["non_tunai"]) == 2

    # Verifikasi to_dict
    d = saved.to_dict()
    assert "detail_metode" in d
    assert d["detail_metode"]["total_non_tunai"] == 65000
