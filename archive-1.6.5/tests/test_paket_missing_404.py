import pytest

from app import create_app
from app.models import db, User


@pytest.fixture
def admin_client(tmp_path):
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path/'paket.db'}",
    })
    with app.app_context():
        db.create_all()
        admin = User.query.filter_by(username="admin").first()
        with app.test_client() as client:
            with client.session_transaction() as sess:
                sess["kasir_id"] = admin.id
                sess["kasir_username"] = admin.username
                sess["kasir_role"] = "admin"
            yield client
        db.session.remove()
        db.drop_all()


def test_edit_paket_hilang_404(admin_client):
    assert admin_client.put("/api/v1/kasir/paket/999999", json={"nama": "X"}).status_code == 404


def test_hapus_paket_hilang_404(admin_client):
    assert admin_client.delete("/api/v1/kasir/paket/999999").status_code == 404
