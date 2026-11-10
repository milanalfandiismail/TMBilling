from io import BytesIO
import pytest
from werkzeug.datastructures import FileStorage
from app import create_app, db
from app.models import User
from app.routes.menu.menu_routes import handle_image_upload


@pytest.fixture
def ctx():
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
    })
    with app.app_context():
        db.create_all()
        admin = User(username="admin_upload", nama_lengkap="Admin", role="admin")
        admin.set_password("pass123")
        db.session.add(admin)
        db.session.commit()
        yield app, admin


def test_menu_menolak_file_bukan_gambar(ctx):
    file = FileStorage(stream=BytesIO(b"bukan gambar"), filename="palsu.png")

    with pytest.raises(ValueError, match="gambar"):
        handle_image_upload(file)


def test_tutorial_menolak_file_bukan_gambar(ctx):
    app, admin = ctx
    client = app.test_client()
    with client.session_transaction() as sess:
        sess["kasir_id"] = admin.id
        sess["kasir_username"] = admin.username
        sess["kasir_role"] = admin.role

    resp = client.post(
        "/api/v1/kasir/tutorials/upload-image",
        data={"upload": (BytesIO(b"bukan gambar"), "palsu.png")},
        content_type="multipart/form-data",
    )

    assert resp.status_code == 400
