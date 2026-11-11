import os
import uuid

import pytest

from app import create_app, db
from app.models import User


@pytest.fixture
def app_ctx(tmp_path, monkeypatch):
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
    })
    monkeypatch.setattr(app, "root_path", str(tmp_path))
    temp_dir = tmp_path / "static" / "assets" / "tutorials" / "temp"
    temp_dir.mkdir(parents=True)
    with app.app_context():
        db.create_all()
        admin = User(username="admin_tut", nama_lengkap="Admin", role="admin")
        admin.set_password("pass123")
        db.session.add(admin)
        db.session.commit()
        admin_id = admin.id
    yield app, temp_dir, admin_id


def _login(client, user_id):
    with client.session_transaction() as sess:
        sess["kasir_id"] = user_id
        sess["kasir_username"] = "admin_tut"
        sess["kasir_role"] = "admin"


def test_cleanup_hanya_menghapus_file_yang_dikirim(app_ctx):
    app, temp_dir, admin_id = app_ctx
    milik_saya = f"{uuid.uuid4().hex}.png"
    milik_editor_lain = f"{uuid.uuid4().hex}.png"
    (temp_dir / milik_saya).write_bytes(b"x")
    (temp_dir / milik_editor_lain).write_bytes(b"x")

    client = app.test_client()
    _login(client, admin_id)
    resp = client.post("/api/v1/kasir/tutorials/cleanup-temp",
                       json={"files": [f"/static/assets/tutorials/temp/{milik_saya}",
                                       "../../evil.txt"]})

    assert resp.status_code == 200
    assert resp.get_json()["removed"] == 1
    assert not (temp_dir / milik_saya).exists()
    assert (temp_dir / milik_editor_lain).exists()
