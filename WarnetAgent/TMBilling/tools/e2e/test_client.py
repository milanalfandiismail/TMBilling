"""End-to-end checks against a throwaway server and the real client binary."""

import ctypes
import subprocess
import time
import unittest
from pathlib import Path

from PIL import Image

from tools.e2e.fixture import Client, Server, wait_until

OUT = Path("X:/Temp/opencode/e2e-out")
user32 = ctypes.windll.user32


def white_pixels(path):
    img = Image.open(path).convert("RGB")
    w, h = img.size
    px = img.load()
    n = 0
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            r, g, b = px[x, y]
            if r > 200 and g > 200 and b > 200:
                n += 1
    return n


def accent_pixels(path):
    img = Image.open(path).convert("RGB")
    w, h = img.size
    px = img.load()
    n = 0
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            r, g, b = px[x, y]
            if g > 150 and r < 120 and b > 100:
                n += 1
    return n


def red_rows(path, y0=0, y1=None):
    img = Image.open(path).convert("RGB")
    w, h = img.size
    y1 = y1 or h
    px = img.load()
    rows = []
    for y in range(y0, y1):
        n = sum(1 for x in range(w) if px[x, y][0] > 150 and px[x, y][1] < 110 and px[x, y][2] < 110)
        if n > 6:
            rows.append(y)
    return rows


class Base(unittest.TestCase):
    def setUp(self):
        self.server = Server().start()
        self.ids = self.server.seed_warnet()
        self.client = None

    def tearDown(self):
        if self.client:
            self.client.stop()
        self.server.cleanup()

    def kiosk(self, env=None):
        self.client = Client().start(self.server, env=env, args=("--size", "1920x1080"))
        wait_until(lambda: "[poll] ok" in self.client.log_text(), 25)
        return self.client

    def login(self, user="budi", password="rahasia123"):
        c = self.client
        c.click(280, 442)
        c.type_text(user)
        c.click(280, 528)
        c.type_text(password)
        c.click(280, 610)

    def overlay(self, paket="paket_15m", env=None):
        self.kiosk(env=env)
        self.server.open_member_session(self.ids[paket])
        wait_until(lambda: self.client.size()[0] < 800, 30)
        return self.client


class AuthTest(Base):
    def test_identify_registers_pc(self):
        self.kiosk()
        self.assertIn('identify valid=true pc=Some("PC-01")', self.client.log_text())

    def test_login_moves_to_overlay(self):
        self.kiosk()
        self.login()
        wait_until(lambda: self.client.size()[0] < 800, 25)
        w, h = self.client.size()
        self.assertEqual((w, h), (396, 276))
        wait_until(lambda: self.server.active_session() is not None, 10)

    def test_wrong_password_shows_banner(self):
        self.kiosk()
        self.login(password="salahbanget")
        time.sleep(4)
        shot = OUT / "wrong-password.png"
        self.client.shot(str(shot))
        self.assertTrue(red_rows(str(shot)), "banner error tidak muncul")
        self.assertGreater(self.client.size()[0], 800, "kiosk tidak boleh pindah layar")

    def test_empty_submit_shows_banner(self):
        self.kiosk()
        self.client.click(280, 610)
        time.sleep(2)
        shot = OUT / "empty-submit.png"
        self.client.shot(str(shot))
        self.assertTrue(red_rows(str(shot)))

    def test_f11_opens_admin_modal_on_kiosk(self):
        self.kiosk()
        self.client.press(0x7A)  # F11
        time.sleep(1.5)
        shot = OUT / "f11.png"
        self.client.shot(str(shot))
        img = Image.open(shot).convert("RGB")
        self.assertEqual(img.size, (1936, 1088))
        # dialog admin punya border accent di sekitar input password
        self.assertGreater(accent_pixels(str(shot)), 100, "modal admin tidak terlihat")


class OverlayTest(Base):
    def test_tabs_have_no_white_flash(self):
        self.overlay()
        for name, x in (("alat", 190), ("qris", 285), ("sesi", 95)):
            self.client.click(x, 200)
            time.sleep(0.6)
            shot = OUT / f"tab-{name}.png"
            self.client.shot(str(shot))
            self.assertLess(white_pixels(str(shot)), 12000, f"tab {name} punya area putih")

    def test_logout_opens_confirm(self):
        self.overlay()
        before = OUT / "ov-before.png"
        self.client.shot(str(before))
        self.client.click(282, 150)
        time.sleep(1.0)
        after = OUT / "ov-logout.png"
        self.client.shot(str(after))
        self.assertGreater(Image.open(after).size[0], 1000, "modal logout harus fullscreen")
        self.client.click(1019, 607)  # Batal
        wait_until(lambda: self.client.size()[0] < 800, 10)

    def test_lock_pin_modal_ignores_escape(self):
        self.overlay()
        self.client.click(98, 150)
        time.sleep(1.0)
        self.assertGreater(self.client.size()[0], 1000, "modal PIN harus fullscreen")
        user32.SetForegroundWindow(self.client.hwnd)
        self.client.press(0x1B)
        time.sleep(0.8)
        self.assertGreater(self.client.size()[0], 1000, "Escape tidak boleh menutup PIN")


class HostTest(Base):
    def test_window_is_topmost(self):
        c = self.overlay()
        GWL_EXSTYLE, WS_EX_TOPMOST = -20, 0x00000008
        style = user32.GetWindowLongW(c.hwnd, GWL_EXSTYLE)
        self.assertTrue(style & WS_EX_TOPMOST)

    def test_single_instance(self):
        c = self.kiosk()
        from tools.e2e.fixture import CLIENT_EXE
        p = subprocess.run([str(CLIENT_EXE)], capture_output=True, timeout=30)
        self.assertEqual(p.returncode, 0)
        self.assertTrue(user32.IsWindow(c.hwnd))


class KioskUiTest(Base):
    def test_qris_tile_opens_fullscreen(self):
        c = self.kiosk()
        before = c.size()
        c.click(849, 495)
        time.sleep(1.2)
        shot = OUT / "qris-full.png"
        c.shot(str(shot))
        self.assertGreaterEqual(Image.open(shot).size[0], before[0])
        # scrim penuh: hampir seluruh layar berwarna #050505
        img = Image.open(shot).convert("RGB")
        px = img.load()
        dark = sum(1 for y in range(0, img.size[1], 8) for x in range(0, img.size[0], 8)
                   if px[x, y] == (5, 5, 5))
        total = (img.size[1] // 8) * (img.size[0] // 8)
        self.assertGreater(dark / total, 0.5, "QRIS fullscreen tidak menutup layar")

    def test_server_down_keeps_kiosk_alive(self):
        c = self.kiosk()
        self.server.stop()
        wait_until(lambda: "error" in c.log_text().lower(), 20)
        self.assertGreater(c.size()[0], 800)
        self.assertIsNone(c.proc.poll(), "klien tidak boleh mati saat server mati")


class SlowSessionTest(Base):
    """Butuh jam nyata (~70 detik)."""

    def test_minute_ticks_and_kasir_close_returns_to_kiosk(self):
        c = self.kiosk()
        self.server.open_guest_session(self.ids["paket_15m"])
        wait_until(lambda: c.size()[0] < 800, 30)
        wait_until(lambda: "sisa=Some(14)" in c.log_text(), 90)
        sesi = self.server.active_session()
        self.assertIsNotNone(sesi)
        status, body = self.server.post(f"/api/v1/kasir/sesi/tutup/{sesi}", {})
        self.assertIn(status, (200, 201), body)
        wait_until(lambda: c.size()[0] > 800, 30)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    unittest.main(verbosity=2)
