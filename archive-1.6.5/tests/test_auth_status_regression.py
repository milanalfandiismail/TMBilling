import pytest

from app import create_app
from app.models import User, db


@pytest.fixture
def ctx(tmp_path):
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path/'auth.db'}",
    })
    with app.app_context():
        db.create_all()
        u = User(username="admin1", role="admin", aktif=True, nama_lengkap="Admin")
        u.set_password("rahasia")
        db.session.add(u)
        db.session.commit()
        yield app, u.id


def test_demoted_admin_langsung_kehilangan_akses(ctx):
    app, uid = ctx
    c = app.test_client()
    assert c.post("/api/v1/kasir/auth/login",
                  json={"username": "admin1", "password": "rahasia"}).status_code == 200
    u = db.session.get(User, uid)
    u.role = "kasir"
    db.session.commit()
    db.session.expire_all()
    assert c.put("/api/v1/kasir/settings/auto-shutdown",
                 json={"timer_seconds": 60}).status_code == 403
