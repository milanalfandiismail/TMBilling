import io

import pytest
from PIL import Image

from app import create_app, db
from app.models import Grup, PC


def _png_bytes():
    buf = io.BytesIO()
    Image.new("RGB", (8, 8), "red").save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def app_ctx(tmp_path):
    instance_dir = tmp_path / "instance"
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "SECRET_KEY": "test-screenshot",
        "CLIENT_API_KEY": "test-key",
        "INSTANCE_PATH": str(instance_dir),
    })
    app.static_folder = str(tmp_path / "static")
    with app.app_context():
        db.create_all()
        grup = Grup(nama="reguler")
        db.session.add(grup)
        db.session.flush()
        pc_a = PC(kode="PC-A", nama="PC-A", ip_address="127.0.0.1",
                  mac_address="AA:BB:CC:DD:EE:01", grup_id=grup.id, aktif=True)
        pc_b = PC(kode="PC-B", nama="PC-B", ip_address="10.0.0.2",
                  mac_address="AA:BB:CC:DD:EE:02", grup_id=grup.id, aktif=True)
        db.session.add_all([pc_a, pc_b])
        db.session.commit()
        yield app.test_client(), pc_a, pc_b, instance_dir / "uploads" / "screenshots"
        db.session.remove()
        db.drop_all()


def test_upload_uses_peer_ip_and_ignores_ip_header(app_ctx):
    client, pc_a, pc_b, folder = app_ctx
    res = client.post(
        "/api/v1/public/monitor/screenshot/upload",
        data=_png_bytes(),
        headers={"X-Client-Key": "test-key", "X-IP-Address": pc_b.ip_address},
    )
    assert res.status_code == 200
    assert (folder / f"{pc_a.kode}.png").exists()
    assert not (folder / f"{pc_b.kode}.png").exists()


def test_upload_rejects_non_image_bytes(app_ctx):
    client, pc_a, pc_b, folder = app_ctx
    res = client.post(
        "/api/v1/public/monitor/screenshot/upload",
        data=b"bukan gambar",
        headers={"X-Client-Key": "test-key"},
    )
    assert res.status_code == 400
    assert not (folder / f"{pc_a.kode}.png").exists()
