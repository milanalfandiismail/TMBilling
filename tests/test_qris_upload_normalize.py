import io
import os
import tempfile
import unittest
from unittest import mock

from PIL import Image

from app import create_app
from app.models import db, User
from app.services import SettingsService


class TestQrisUploadNormalize(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.app = create_app()
        self.app.static_folder = self.tmp
        self.app.config["TESTING"] = True
        self.app.config["WTF_CSRF_ENABLED"] = False
        self.app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
        self.client = self.app.test_client()
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()
        user = User(username="admin_qris", nama_lengkap="admin", role="admin", aktif=True)
        user.set_password("rahasia123")
        db.session.add(user)
        db.session.commit()
        with self.client.session_transaction() as sess:
            sess["kasir_id"] = user.id
            sess["kasir_username"] = user.username
            sess["kasir_role"] = "admin"

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def _png(self, size):
        img = Image.new("RGB", size, "white")
        img.paste((0, 0, 0), (0, 0, size[0] // 2, size[1] // 2))
        buf = io.BytesIO()
        img.save(buf, "PNG")
        buf.seek(0)
        return buf

    def test_large_image_is_downscaled_and_setting_updated(self):
        res = self.client.post(
            "/api/v1/kasir/settings/qris",
            data={"qris_image": (self._png((2000, 1500)), "foto.png")},
            content_type="multipart/form-data",
        )
        self.assertEqual(res.status_code, 200)
        url = res.get_json()["qris_url"]
        self.assertEqual(SettingsService.get("qris_image_url"), url)
        path = os.path.join(self.tmp, "uploads", "qris", os.path.basename(url))
        with Image.open(path) as out:
            self.assertLessEqual(max(out.size), 800)
        self.assertLess(os.path.getsize(path), 200_000)

    def test_non_image_upload_is_rejected(self):
        res = self.client.post(
            "/api/v1/kasir/settings/qris",
            data={"qris_image": (io.BytesIO(b"bukan gambar"), "palsu.png")},
            content_type="multipart/form-data",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIsNone(SettingsService.get("qris_image_url") or None)


if __name__ == "__main__":
    unittest.main()
