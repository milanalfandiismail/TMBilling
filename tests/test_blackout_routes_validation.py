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
