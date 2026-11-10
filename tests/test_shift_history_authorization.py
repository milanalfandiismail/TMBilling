import pytest
from app import create_app, db
from app.models import User, ShiftRecord


@pytest.fixture
def ctx():
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
    })
    with app.app_context():
        db.create_all()
        a = User(username="kasir_a", nama_lengkap="A", role="kasir")
        b = User(username="kasir_b", nama_lengkap="B", role="kasir")
        for u in (a, b):
            u.set_password("pass123")
        db.session.add_all([a, b])
        db.session.commit()
        shift_a = ShiftRecord(kasir_id=a.id, modal_awal=0, status="SELESAI")
        shift_b = ShiftRecord(kasir_id=b.id, modal_awal=0, status="SELESAI")
        db.session.add_all([shift_a, shift_b])
        db.session.commit()
        yield app, a, b, shift_a, shift_b


def _login(client, user):
    with client.session_transaction() as sess:
        sess["kasir_id"] = user.id
        sess["kasir_username"] = user.username
        sess["kasir_role"] = user.role


def test_kasir_hanya_melihat_shift_sendiri(ctx):
    app, a, b, shift_a, _ = ctx
    client = app.test_client()
    _login(client, a)

    resp = client.get(f"/api/v1/kasir/shift/history?kasir_id={b.id}")

    assert resp.status_code == 200
    ids = [s["id"] for s in resp.get_json()["shifts"]["data"]]
    assert ids == [shift_a.id]


def test_limit_shift_harus_valid(ctx):
    app, a, _, _, _ = ctx
    client = app.test_client()
    _login(client, a)

    assert client.get("/api/v1/kasir/shift/history?limit=-1").status_code == 400
    assert client.get("/api/v1/kasir/shift/history?offset=-1").status_code == 400
    assert client.get("/api/v1/kasir/shift/history?tanggal_mulai=abc").status_code == 400
