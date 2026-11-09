from app import create_app, db
from app.models import User


def test_invalid_pagination_returns_400():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
                      "SECRET_KEY": "test-pagination"})
    with app.app_context():
        db.create_all()
        u = User(username="adminp", nama_lengkap="Admin", role="admin", aktif=True)
        u.set_password("x"); db.session.add(u); db.session.commit()
        client = app.test_client()
        with client.session_transaction() as s:
            s["kasir_id"] = u.id; s["kasir_username"] = "adminp"; s["kasir_role"] = "admin"
        for path in ("/api/v1/kasir/report/laporan/billing", "/api/v1/kasir/report/laporan/kantin"):
            assert client.get(path, query_string={"per_page": 0}).status_code == 400
            assert client.get(path, query_string={"page": -1}).status_code == 400
