import pytest
from app import create_app
from app.models import db, User


@pytest.fixture
def client():
    app = create_app({"TESTING": True, "WTF_CSRF_ENABLED": False,
                      "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        user = User.query.filter_by(role="admin").first()
        assert user is not None
        user_id = user.id

    c = app.test_client()
    with c.session_transaction() as sess:
        sess["kasir_id"] = user_id
        sess["kasir_role"] = "admin"
        sess["kasir_username"] = "admin"
    return c


@pytest.mark.parametrize("value", ["abc", -5, 0, 1441])
def test_threshold_tidak_valid_ditolak(client, value):
    res = client.post("/api/v1/kasir/blackout/deteksi", json={"threshold_menit": value})
    assert res.status_code == 400


@pytest.fixture
def client_kasir():
    app = create_app({"TESTING": True, "WTF_CSRF_ENABLED": False,
                      "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        user = User(username="kasir_blackout", nama_lengkap="Kasir Blackout", role="kasir")
        user.set_password("rahasia")
        db.session.add(user)
        db.session.commit()
        user_id = user.id
    c = app.test_client()
    with c.session_transaction() as sess:
        sess["kasir_id"] = user_id
        sess["kasir_role"] = "kasir"
        sess["kasir_username"] = "kasir_blackout"
    return c


def test_force_all_kasir_tanpa_shift_ditolak(client_kasir):
    res = client_kasir.post("/api/v1/kasir/blackout/force-all-and-detect")
    assert res.status_code == 400
    assert "buka shift" in res.get_json()["error"]


def test_force_all_kasir_dengan_shift_bisa(client_kasir, monkeypatch):
    monkeypatch.setattr(
        "app.routes.blackout.blackout_routes.BlackoutService.force_all_and_detect",
        staticmethod(lambda operator: {"tutup": 0, "deteksi": 0}))
    with client_kasir.application.app_context():
        from app.models import db
        from app.models.shift.shift_record import ShiftRecord
        from app.models.user.user import User
        kasir = User.query.filter_by(username="kasir_blackout").first()
        db.session.add(ShiftRecord(kasir_id=kasir.id, modal_awal=0, status="AKTIF"))
        db.session.commit()
    res = client_kasir.post("/api/v1/kasir/blackout/force-all-and-detect")
    assert res.status_code == 200
    assert res.get_json()["success"] is True


def test_force_all_admin_tetap_bisa(client, monkeypatch):
    monkeypatch.setattr(
        "app.routes.blackout.blackout_routes.BlackoutService.force_all_and_detect",
        staticmethod(lambda operator: {"tutup": 0, "deteksi": 0}))
    res = client.post("/api/v1/kasir/blackout/force-all-and-detect")
    assert res.status_code == 200
