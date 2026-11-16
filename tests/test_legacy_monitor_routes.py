import pytest
from app import create_app
from app.models import db, User


@pytest.fixture
def client(tmp_path):
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path/'mon.db'}",
    })
    with app.app_context():
        db.create_all()
        u = User(username="admin1", role="admin", aktif=True)
        u.set_password("rahasia")
        db.session.add(u)
        db.session.commit()
    c = app.test_client()
    c.post("/api/v1/kasir/auth/login", json={"username": "admin1", "password": "rahasia"})
    return c


def test_endpoint_monitor_legacy_sudah_hilang(client):
    assert client.get("/api/v1/public/monitor/all").status_code == 404
    assert client.get("/api/v1/public/monitor/processes/1").status_code == 404
    assert client.post("/api/v1/public/monitor/processes/1/kill", json={}).status_code == 404
    assert client.delete("/api/v1/public/monitor/1").status_code == 404
