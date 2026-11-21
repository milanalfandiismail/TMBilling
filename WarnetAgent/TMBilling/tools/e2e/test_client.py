"""End-to-end checks against a throwaway server and the real client binary."""

import ctypes
import os
import subprocess
import threading
import time
import unittest
from pathlib import Path

from PIL import Image, ImageChops

from tools.e2e.fixture import CLIENT_KEY, Client, Server, local_net, wait_until
from tools.e2e.flash_probe import burst, report, settled_white

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
        OUT.mkdir(parents=True, exist_ok=True)
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
        wait_until(self.client.visible, 5)
        return self.client

    def guest(self, paket="paket_15m", env=None):
        OUT.mkdir(parents=True, exist_ok=True)
        self.kiosk(env=env)
        self.server.open_guest_session(self.ids[paket])
        wait_until(lambda: self.client.size()[0] < 800, 30)
        wait_until(self.client.visible, 5)
        return self.client

    def close_session(self):
        sesi = self.server.active_session()
        self.assertIsNotNone(sesi, "tidak ada sesi aktif")
        self.server.post(f"/api/v1/kasir/sesi/tutup/{sesi}")


class AuthTest(Base):
    def test_identify_registers_pc(self):
        self.kiosk()
        self.assertIn('identify valid=true pc=Some("PC-01")', self.client.log_text())

    def test_login_moves_to_overlay(self):
        self.kiosk()
        self.login()
        wait_until(lambda: self.client.size()[0] < 800, 25)
        w, h = self.client.size()
        self.assertEqual((w, h), (380, 268))
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
        self.assertEqual(img.size, (1920, 1080))
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


class AfkTest(Base):
    def test_afk_locks_screen_and_credentials_unlock(self):
        c = self.overlay()
        status, body = self.server.request(
            "POST", "/api/v1/public/client/afk-lock",
            {"ip_address": local_net()[0], "mac_address": ""},
            {"X-Client-Key": CLIENT_KEY},
        )
        self.assertIn(status, (200, 201), body)
        wait_until(lambda: c.size()[0] > 1000, 15)
        c.type_text("rahasia123")
        c.press(0x0D)
        wait_until(lambda: c.size()[0] < 800, 15)


class ShutdownTest(Base):
    def test_idle_pc_runs_shutdown_countdown(self):
        c = self.kiosk(env={"TM_NO_POWER": "1"})
        wait_until(lambda: "[power] /s" in c.log_text(), 60)
        self.assertIn("[power] /s (dinonaktifkan)", c.log_text())


class FlickerTest(Base):
    def test_fullscreen_modal_never_shows_at_origin_while_small(self):
        c = self.overlay()
        samples = []
        stop = threading.Event()

        def sample():
            while not stop.is_set():
                l, t, r, b = c.rect()
                samples.append((l, t, r - l, b - t))
                time.sleep(0.01)

        th = threading.Thread(target=sample, daemon=True)
        th.start()
        c.click(98, 150)
        wait_until(lambda: c.size()[0] > 1000, 10)
        time.sleep(0.4)
        stop.set()
        th.join()
        bad = [s for s in samples if s[0] == 0 and s[2] < 900]
        self.assertEqual(bad, [], f"frame di x=0 saat masih kecil: {bad[:5]}")


class MemTest(Base):
    def test_tabs_keep_overlay_memory_flat(self):
        c = self.overlay()
        time.sleep(1.5)
        idle = c.working_set()
        c.click(190, 200)  # tab Alat
        time.sleep(1.5)
        alat = c.working_set()
        c.click(285, 200)  # tab QRIS
        time.sleep(1.5)
        qris = c.working_set()
        print(f"[mem] idle={idle // 1024}K alat={alat // 1024}K qris={qris // 1024}K")
        self.assertLess(qris - idle, 6 * 1024 * 1024, "tab QRIS menambah >6 MB")
class TrayTest(Base):
    def test_minimize_hides_from_taskbar_and_second_instance_restores(self):
        from tools.e2e.fixture import CLIENT_DIR as CDIR, CLIENT_EXE
        c = self.overlay()
        before = c.size()
        c.close_window()  # jalur Alt+F4
        wait_until(lambda: not c.visible(), 10)
        self.assertEqual(c.size(), before)
        child_env = os.environ.copy()
        child_env.update({
            "TM_SERVER_URL": self.server.base_url,
            "TM_CLIENT_KEY": "TM2026",
            "TM_DEV_SAFE": "1",
            "TM_NO_POWER": "1",
        })
        subprocess.Popen([str(CLIENT_EXE)], cwd=str(CDIR), env=child_env)
        wait_until(c.visible, 10)
    def test_kiosk_close_is_still_rejected(self):
        c = self.kiosk()
        c.close_window()
        time.sleep(1)
        self.assertTrue(c.visible(), "kiosk tidak boleh bisa ditutup")
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


class AdminLoginTest(Base):
    def admin_login(self, user, password, env=None):
        c = self.kiosk(env=env)
        c.press(0x7A)  # F11
        time.sleep(0.8)
        c.click(960, 510)
        c.type_text(user)
        c.click(960, 576)
        c.type_text(password)
        c.press(0x0D)  # Enter
        return c
    def test_wrong_password_keeps_kiosk_and_shows_error(self):
        c = self.admin_login("admin", "salahbanget")
        time.sleep(3)
        shot = OUT / "admin-wrong.png"
        c.shot(str(shot))
        self.assertGreater(c.size()[0], 800, "password salah tidak boleh membuka overlay")
        self.assertTrue(red_rows(str(shot), 300, 800), "error admin tidak tampil di modal")
    def test_emergency_credentials_open_overlay(self):
        c = self.admin_login(
            "darurat", "kunci123",
            env={"TM_EMERGENCY_USER": "darurat", "TM_EMERGENCY_TOKEN": "kunci123"},
        )
        wait_until(lambda: c.size()[0] < 800, 20)
    def test_admin_survives_one_second_polling(self):
        status, body = self.server.post(
            "/api/v1/kasir/user",
            {"username": "polladmin", "password": "rahasia123",
             "nama_lengkap": "Poll Admin", "role": "kasir"},
        )
        self.assertEqual(status, 201, body)
        self.server.set_setting("client_polling_interval", "1")
        c = self.admin_login("polladmin", "rahasia123")
        wait_until(lambda: c.size()[0] < 800, 20)
        time.sleep(6)
        self.assertLess(c.size()[0], 800, "polling role=client mematikan mode admin")
    def test_kasir_account_from_server_opens_overlay(self):
        status, body = self.server.post(
            "/api/v1/kasir/user",
            {
                "username": "kasiradmin",
                "password": "rahasia123",
                "nama_lengkap": "Kasir E2E",
                "role": "kasir",
            },
        )
        self.assertEqual(status, 201, body)
        c = self.kiosk()
        c.press(0x7A)  # F11
        time.sleep(0.8)
        c.click(960, 510)
        c.type_text("kasiradmin")
        c.click(960, 576)
        c.type_text("rahasia123")
        c.press(0x0D)  # Enter
        wait_until(lambda: c.size()[0] < 800, 20)


class AfkGuestTest(Base):
    def test_guest_pin_modal_locks_and_unlocks(self):
        c = self.kiosk()
        self.server.open_guest_session(self.ids["paket_15m"])
        wait_until(lambda: c.size()[0] < 800, 30)
        c.click(98, 150)  # Lock tile
        time.sleep(0.3)
        c.type_text("1234")
        c.press(0x0D)
        wait_until(lambda: c.size()[0] > 1000, 15)
        c.type_text("1234")
        c.press(0x0D)
        wait_until(lambda: c.size()[0] < 800, 15)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    unittest.main(verbosity=2)

class FlashTest(Base):
    """Tidak boleh ada frame putih transien saat bentuk jendela berubah."""

    def test_transitions_show_no_white_flash(self):
        c = self.overlay()
        settled = {}

        def settle(tag):
            time.sleep(0.5)
            settled[tuple(c.size())] = settled_white(c, tag)

        settle("card")
        total = 0

        def run(name, action, ms=1200):
            nonlocal total
            frames = burst(c, action, name, ms)
            time.sleep(0.6)
            final = settled_white(c, name)
            settled[tuple(c.size())] = final
            total += report(name, frames, settled, final)
            time.sleep(0.5)

        run("e2e-tab-alat", lambda: c.click(190, 200))
        run("e2e-tab-qris", lambda: c.click(285, 200))
        run("e2e-tab-sesi", lambda: c.click(95, 200))
        run("e2e-modal-logout", lambda: c.click(282, 150))
        run("e2e-modal-close", lambda: c.click(1019, 607))
        c.click(285, 200)
        time.sleep(0.5)
        run("e2e-qris-full", lambda: c.click(198, 395), 1600)
        c.click(960, 540)
        time.sleep(0.5)
        run("e2e-session-end", self.close_session, 2500)

        def relogin():
            c.click(280, 442)
            c.type_text("budi")
            c.click(280, 532)
            c.type_text("rahasia123")
            c.click(280, 610)

        run("e2e-login", relogin, 2500)
        self.assertEqual(total, 0, "ada frame putih saat transisi")


def field_crop(path, box=(60, 430, 400, 470)):
    return Image.open(path).convert("RGB").crop(box).tobytes()


def diff_box(before, after):
    a, b = Image.open(before).convert("RGB"), Image.open(after).convert("RGB")
    if a.size != b.size:
        return None
    return ImageChops.difference(a, b).getbbox()


def blink_x(before, after, box):
    a = Image.open(before).convert("RGB").crop(box)
    b = Image.open(after).convert("RGB").crop(box)
    d = ImageChops.difference(a, b).getbbox()
    return None if d is None else d[0]


class InputTest(Base):
    def test_tab_moves_from_username_to_password(self):
        c = self.kiosk()
        c.click(280, 442)
        c.type_text("budi")
        c.press(0x09)
        c.type_text("rahasia123")
        c.press(0x0D)
        wait_until(lambda: c.size()[0] < 800, 20)
        self.assertLess(c.size()[0], 800)

    def test_caret_blinks_in_focused_field(self):
        c = self.kiosk()
        c.click(280, 442)
        time.sleep(0.3)
        shapes = set()
        for i in range(8):
            path = OUT / f"caret-{i}.png"
            c.shot(str(path))
            shapes.add(field_crop(str(path)))
            time.sleep(0.15)
        self.assertGreaterEqual(len(shapes), 2, "caret tidak berkedip")

    def test_caret_leads_placeholder(self):
        c = self.kiosk()
        box = (60, 430, 400, 470)
        shots = []
        for i in range(8):
            path = OUT / f"caret-lead-{i}.png"
            c.shot(str(path))
            shots.append(path)
            time.sleep(0.15)
        offsets = [blink_x(a, b, box) for a, b in zip(shots, shots[1:])]
        visible = [x for x in offsets if x is not None]
        self.assertTrue(visible, "caret tidak terlihat berkedip")
        self.assertLessEqual(min(visible), 30, offsets)


class SessionEndTest(Base):
    def assert_kiosk(self, tag):
        c = self.client
        wait_until(lambda: c.size()[0] > 1800, 20)
        shot = OUT / f"reset-{tag}.png"
        white = 0
        # Window is hidden briefly while it changes size, so poll until the kiosk paints.
        for _ in range(24):
            c.shot(str(shot))
            white = white_pixels(str(shot))
            if white > 1000:
                break
            time.sleep(0.25)
        self.assertGreater(white, 1000, "kiosk tidak kembali")

    def test_logout_modal_is_dropped(self):
        c = self.overlay()
        c.click(282, 150)
        time.sleep(0.5)
        self.close_session()
        self.assert_kiosk("logout")

    def test_afk_pin_modal_is_dropped(self):
        c = self.guest()
        c.click(98, 150)
        wait_until(lambda: c.size()[0] > 1800, 10)
        self.close_session()
        self.assert_kiosk("pin")

    def test_typing_after_session_end_hits_username(self):
        self.kiosk()
        self.login("budi", "rahasia123")
        wait_until(lambda: self.client.size()[0] < 800, 10)
        self.close_session()
        self.assert_kiosk("typename")
        before = self.client.shot(OUT / "typename-before.png")
        self.client.type_text("budi")
        after = self.client.shot(OUT / "typename-after.png")
        box = diff_box(before, after)
        self.assertTrue(box is not None and box[1] < 500 and box[3] < 500, box)
        self.client.press(0x09)
        self.client.type_text("rahasia123")
        self.client.press(0x0D)
        wait_until(lambda: self.client.size()[0] < 800, 10)

    def test_admin_fields_are_empty_after_session_end(self):
        self.kiosk()
        self.login("budi", "rahasia123")
        wait_until(lambda: self.client.size()[0] < 800, 10)
        self.close_session()
        self.assert_kiosk("adminfields")
        self.client.press(0x7A)
        time.sleep(0.4)
        before = self.client.shot(OUT / "adminuser-a.png")
        self.client.type_text("kasir")
        after = self.client.shot(OUT / "adminuser-b.png")
        box = diff_box(before, after)
        self.assertTrue(box is not None, "ketikan tidak tampil di modal admin")
        self.assertLess(box[1], 540, f"ketikan tidak masuk kolom username admin: {box}")

    def test_fullscreen_qris_is_dropped(self):
        c = self.overlay()
        c.click(285, 200)
        time.sleep(0.4)
        c.click(198, 395)
        wait_until(lambda: c.size()[0] > 1800, 10)
        self.close_session()
        self.assert_kiosk("qris")


class FitTest(Base):
    def test_overlay_window_is_card_sized(self):
        c = self.overlay("paket_15m")
        w, h = c.size()
        self.assertLessEqual(abs(w - 380), 1, (w, h))
        self.assertLessEqual(abs(h - 268), 1, (w, h))
        path = OUT / "fit-overlay.png"
        # Window bisa di-reveal sebelum frame baru dilukis: tunggu dinding kartu.
        for _ in range(20):
            c.shot(str(path))
            img = Image.open(path).convert("RGB")
            if img.getpixel((img.width - 2, img.height // 2)) != (5, 5, 5):
                break
            time.sleep(0.1)
        self.assertNotEqual(img.getpixel((img.width - 2, img.height // 2)), (5, 5, 5))

    def test_kiosk_matches_monitor(self):
        c = self.kiosk()
        w, h = c.size()
        self.assertLessEqual(abs(w - 1920), 1, (w, h))
        self.assertLessEqual(abs(h - 1080), 1, (w, h))
