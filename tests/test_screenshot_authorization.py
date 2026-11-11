import os

import pytest
from PIL import Image

from app import create_app, db
from app.models import Grup, PC, User
from app.routes.monitor.screenshot_routes import migrate_legacy_screenshots


def _save_png(path):
    Image.new("RGB", (8, 8), "red").save(path, format="PNG")


@pytest.fixture
def app_client(tmp_path):
    static_dir = tmp_path / "static"
    instance_dir = tmp_path / "instance"
    static_dir.mkdir()
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "SECRET_KEY": "test-screenshot-auth",
        "INSTANCE_PATH": str(instance_dir),
    })
    app.static_folder = str(static_dir)

    screenshot_dir = instance_dir / "uploads" / "screenshots"
    screenshot_dir.mkdir(parents=True)

    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.flush()
        pc = PC(kode="PC-A", nama="PC-A", ip_address="127.0.0.1",
                mac_address="AA:BB:CC:DD:EE:01", grup_id=grup.id, aktif=True)
        admin = User(username="adminx", nama_lengkap="Admin", role="admin", aktif=True)
        kasir = User(username="kasirx", nama_lengkap="Kasir", role="kasir", aktif=True)
        admin.set_password("x")
        kasir.set_password("x")
        db.session.add_all([pc, admin, kasir])
        db.session.commit()
        _save_png(screenshot_dir / "PC-A.png")

        yield app, pc, admin, kasir

        db.session.remove()
        db.drop_all()


def _login(app, user):
    client = app.test_client()
    with client.session_transaction() as sess:
        sess["kasir_id"] = user.id
        sess["kasir_username"] = user.username
        sess["kasir_role"] = user.role
    return client


def test_screenshot_is_not_public(app_client):
    app, pc, _admin, _kasir = app_client
    anon = app.test_client()

    assert anon.get("/api/v1/kasir/monitor/screenshot/all").status_code == 401
    assert anon.get(f"/api/v1/kasir/monitor/screenshot/status/{pc.id}").status_code == 401
    assert anon.get(f"/api/v1/kasir/monitor/screenshot/image/{pc.id}").status_code == 401
    assert anon.get("/static/uploads/screenshots/PC-A.png").status_code == 404


def test_cashier_cannot_read_screenshot_data(app_client):
    app, pc, _admin, kasir = app_client
    client = _login(app, kasir)

    assert client.get("/api/v1/kasir/monitor/screenshot/all").status_code == 403
    assert client.get(f"/api/v1/kasir/monitor/screenshot/status/{pc.id}").status_code == 403
    assert client.get(f"/api/v1/kasir/monitor/screenshot/image/{pc.id}").status_code == 403


def test_admin_can_read_screenshot_data(app_client):
    app, pc, admin, _kasir = app_client
    client = _login(app, admin)

    listing = client.get("/api/v1/kasir/monitor/screenshot/all")
    assert listing.status_code == 200
    row = listing.get_json()["data"][0]
    assert set(row) == {
        "pc_id", "pc_kode", "pc_grup_id", "pc_grup_nama",
        "screenshot_url", "screenshot_time", "screenshot_time_display", "mtime",
    }
    assert row["screenshot_url"] == f"/api/v1/kasir/monitor/screenshot/image/{pc.id}"

    status = client.get(f"/api/v1/kasir/monitor/screenshot/status/{pc.id}")
    assert status.status_code == 200
    assert status.get_json()["screenshot_url"] == f"/api/v1/kasir/monitor/screenshot/image/{pc.id}"

    image = client.get(f"/api/v1/kasir/monitor/screenshot/image/{pc.id}")
    assert image.status_code == 200
    assert image.mimetype == "image/png"


def test_image_route_returns_404_for_missing_pc_or_file(app_client):
    app, pc, admin, _kasir = app_client
    client = _login(app, admin)

    assert client.get("/api/v1/kasir/monitor/screenshot/image/9999").status_code == 404

    os.remove(os.path.join(app.instance_path, "uploads", "screenshots", "PC-A.png"))
    assert client.get(f"/api/v1/kasir/monitor/screenshot/image/{pc.id}").status_code == 404


def test_legacy_screenshots_are_moved_before_serving(app_client, tmp_path):
    app, _pc, _admin, _kasir = app_client
    legacy = tmp_path / "static" / "uploads" / "screenshots"
    legacy.mkdir(parents=True)
    _save_png(legacy / "PC-LEGACY.png")

    migrate_legacy_screenshots(app)

    assert not (legacy / "PC-LEGACY.png").exists()
    assert (tmp_path / "instance" / "uploads" / "screenshots" / "PC-LEGACY.png").exists()
