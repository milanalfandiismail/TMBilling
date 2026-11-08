import pytest

from app import create_app
from app.models import db, User
from app.services.report import report_service


@pytest.fixture
def admin_client(tmp_path):
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path/'logs.db'}",
    })
    with app.app_context():
        db.create_all()
        client = app.test_client()
        admin = User.query.filter_by(username="admin").first()
        with client.session_transaction() as sess:
            sess["kasir_id"] = admin.id
            sess["kasir_username"] = admin.username
            sess["kasir_role"] = "admin"
            sess["kasir_nama"] = admin.nama_lengkap
        yield client
        db.session.remove()
        db.drop_all()


def test_clear_logs_route_tidak_500(admin_client, monkeypatch):
    calls = []

    def fake_clear(operator="system", archive=True):
        calls.append((operator, archive))
        return {"success": True, "total_dibersihkan": 0, "archive_path": None}

    monkeypatch.setattr(report_service.LogAuditService, "clear_system_logs", staticmethod(fake_clear))
    res = admin_client.post("/api/v1/kasir/report/log/clear", json={"archive": False})
    assert res.status_code == 200
    assert res.get_json()["success"] is True
    assert calls and calls[0][1] is False
