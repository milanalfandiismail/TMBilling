from app import create_app, db
from app.models import User


def test_invalid_date_returns_400():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
                      "SECRET_KEY": "test-report-date"})
    with app.app_context():
        db.create_all()
        u = User(username="adminr", nama_lengkap="Admin", role="admin", aktif=True)
        u.set_password("x"); db.session.add(u); db.session.commit()
        client = app.test_client()
        with client.session_transaction() as s:
            s["kasir_id"] = u.id; s["kasir_username"] = "adminr"; s["kasir_role"] = "admin"
        for path in ("/api/v1/kasir/report/laporan/billing", "/api/v1/kasir/report/laporan/kantin"):
            res = client.get(path, query_string={"tanggal": "2026-02-31"})
            assert res.status_code == 400, path
