from app import create_app
from app.models import db, User


def test_route_plugin_sudah_hilang(tmp_path):
    app = create_app(
        {
            "TESTING": True,
            "WTF_CSRF_ENABLED": False,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'plug.db'}",
        }
    )
    with app.app_context():
        db.create_all()
        user = User(username="admin1", role="admin", aktif=True)
        user.set_password("rahasia")
        db.session.add(user)
        db.session.commit()
    client = app.test_client()
    client.post(
        "/api/v1/kasir/auth/login",
        json={"username": "admin1", "password": "rahasia"},
    )
    assert client.get("/api/v1/kasir/settings/plugins/").status_code == 404
