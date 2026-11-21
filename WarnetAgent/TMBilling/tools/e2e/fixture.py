"""Fixture: throwaway TMBilling server and the real GPUI client."""

import ctypes
import http.cookiejar
import json
import os
import shutil
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

CLIENT_DIR = Path(__file__).resolve().parents[2]
REPO = CLIENT_DIR.parents[1]
SERVER_EXE = Path(os.environ.get("TM_SERVER_EXE") or REPO / "app-rust" / "target" / "release" / "tmbilling-server.exe")
CLIENT_EXE = CLIENT_DIR / "target" / "debug" / "TMBilling.exe"
CLIENT_KEY = "TM2026"

user32 = ctypes.windll.user32


def local_net():
    import uuid
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    finally:
        s.close()
    mac = uuid.getnode()
    mac_str = ":".join(f"{(mac >> (8 * i)) & 0xFF:02X}" for i in range(6))
    return ip, mac_str


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def wait_until(fn, timeout, interval=0.25):
    deadline = time.monotonic() + timeout
    last = None
    while time.monotonic() < deadline:
        last = fn()
        if last:
            return last
        time.sleep(interval)
    raise AssertionError(f"timeout after {timeout}s, last value: {last!r}")


class Server:
    def __init__(self):
        self.dir = Path(tempfile.mkdtemp(prefix="tm-e2e-"))
        self.port = free_port()
        self.base_url = f"http://127.0.0.1:{self.port}"
        self.cookies = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.cookies)
        )
        self.proc = None
        self.password = ""
        self.log = None

    def csrf_token(self):
        for c in self.cookies:
            if c.name == "csrf_token":
                return c.value
        return ""

    def request(self, method, path, body=None, headers=None):
        data = None
        hdrs = {"Accept": "application/json"}
        if body is not None:
            data = json.dumps(body).encode()
            hdrs["Content-Type"] = "application/json"
        token = self.csrf_token()
        if token:
            hdrs["X-CSRFToken"] = token
        if headers:
            hdrs.update(headers)
        req = urllib.request.Request(
            self.base_url + path, data=data, headers=hdrs, method=method
        )
        try:
            with self.opener.open(req, timeout=15) as r:
                raw, status = r.read(), r.status
        except urllib.error.HTTPError as e:
            raw, status = e.read(), e.code
        try:
            payload = json.loads(raw or b"null")
        except ValueError:
            payload = {"raw": raw[:200].decode("utf-8", "replace")}
        return status, payload

    def get(self, path):
        return self.request("GET", path)

    def post(self, path, body=None):
        return self.request("POST", path, body if body is not None else {})

    def put(self, path, body=None):
        return self.request("PUT", path, body if body is not None else {})

    def start(self):
        env = os.environ.copy()
        env["PORT"] = str(self.port)
        env["TM_NOTES_DIR"] = str(self.dir / "notes")
        (self.dir / ".env").write_text(
            f"SECRET_KEY=e2e-secret\nCLIENT_API_KEY={CLIENT_KEY}\n", encoding="utf-8"
        )
        self.log = open(self.dir / "server.log", "w", encoding="utf-8")
        self.proc = subprocess.Popen(
            [str(SERVER_EXE)], cwd=str(self.dir), env=env,
            stdout=self.log, stderr=subprocess.STDOUT,
        )
        wait_until(self._healthy, 40)
        info = self.dir / "initial_admin.txt"
        wait_until(lambda: info.exists(), 10)
        for line in info.read_text(encoding="utf-8").splitlines():
            if line.startswith("Password:"):
                self.password = line.split(":", 1)[1].strip()
        self.get("/kasir/login")
        status, body = self.post(
            "/api/v1/kasir/auth/login",
            {"username": "admin", "password": self.password},
        )
        assert status == 200, (status, body)
        return self

    def _healthy(self):
        try:
            return self.request("GET", "/api/health")[0] == 200
        except Exception:
            return False

    def stop(self):
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(10)
            except subprocess.TimeoutExpired:
                self.proc.kill()
        if self.log:
            self.log.close()
            self.log = None

    def restart(self):
        self.stop()
        return self.start()

    def cleanup(self):
        self.stop()
        shutil.rmtree(self.dir, ignore_errors=True)

    def log_text(self):
        try:
            return (self.dir / "server.log").read_text(encoding="utf-8", errors="replace")
        except OSError:
            return ""

    def seed_warnet(self):
        out = {}
        status, body = self.post("/api/v1/kasir/grup", {"nama": "Reguler", "tarif_per_jam": 5000})
        assert status == 201, ("grup", status, body)
        status, body = self.get("/api/v1/kasir/grup/")
        out["grup"] = body["grup"][0]["id"]

        for key, nama, menit, harga in (
            ("paket_1m", "Paket 1 Menit", 1, 1000),
            ("paket_15m", "Paket 15 Menit", 15, 5000),
        ):
            status, body = self.post(
                "/api/v1/kasir/paket",
                {"nama": nama, "durasi_menit": menit, "harga": harga},
            )
            assert status == 201, ("paket", status, body)
            out[key] = body["id"]

        status, body = self.post("/api/v1/kasir/pc", {
            "kode": "PC-01", "ip_address": local_net()[0],
            "mac_address": "", "grup_id": out["grup"],
        })
        assert status == 201, ("pc", status, body)
        out["pc"] = body["pc"]["id"]

        status, body = self.post("/api/v1/kasir/member", {
            "username": "budi", "password": "rahasia123", "nama": "Budi",
            "grup_id": out["grup"],
        })
        assert status == 201, ("member", status, body)
        out["member_id"] = self.member_id("budi")

        status, body = self.post("/api/v1/kasir/shift/start", {"modal_awal": 0})
        assert status in (200, 201), ("shift", status, body)

        status, body = self.post("/api/v1/kasir/member/tambah-waktu", {
            "member_id": out["member_id"],
            "selections": [{"paket_id": out["paket_15m"], "jumlah": 1}],
            "metode_pembayaran": "tunai",
        })
        assert status == 200, ("topup", status, body)

        status, body = self.put(
            "/api/v1/kasir/settings/auto-shutdown", {"timer_seconds": 30}
        )
        assert status == 200, ("auto-shutdown", status, body)
        return out

    def member_id(self, username):
        status, body = self.get("/api/v1/kasir/member/")
        rows = body.get("members") or body.get("member") or body.get("data") or []
        return next(m["id"] for m in rows if m.get("username") == username)

    def pc_row(self, kode="PC-01"):
        status, body = self.get("/api/v1/kasir/pc/")
        rows = body.get("pc_list") or body.get("pcs") or body.get("data") or []
        return next(p for p in rows if p.get("kode") == kode)

    def active_session(self, kode="PC-01"):
        row = self.pc_row(kode)
        return row.get("sesi_id")

    def open_guest_session(self, paket_id, nama="tamu"):
        status, body = self.post("/api/v1/kasir/sesi/buka-guest", {
            "pc_kode": "PC-01", "paket_id": paket_id, "nama_guest": nama,
            "metode_pembayaran": "tunai",
        })
        assert status in (200, 201), ("buka-guest", status, body)
        return body.get("sesi_id")

    def set_setting(self, key, value):
        return self.put(f"/api/v1/kasir/settings/{key}", {"value": value})

    def open_member_session(self, paket_id, username="budi"):
        status, body = self.post("/api/v1/kasir/sesi/buka-member", {
            "pc_kode": "PC-01", "paket_id": paket_id,
            "username": username, "metode_pembayaran": "saldo",
        })
        assert status in (200, 201), ("buka-member", status, body)
        return body.get("sesi", {}).get("id") or body.get("sesi_id")


class Client:
    def __init__(self):
        self.proc = None
        self.hwnd = 0
        self.log_path = None
        self.log_file = None

    def start(self, server, env=None, args=()):
        subprocess.run(["taskkill", "/IM", "TMBilling.exe", "/F"],
                       capture_output=True)
        time.sleep(0.5)
        child_env = os.environ.copy()
        child_env.update({
            "TM_SERVER_URL": server.base_url,
            "TM_CLIENT_KEY": CLIENT_KEY,
            "TM_DEV_SAFE": "1",
            "TM_NO_POWER": "1",
        })
        if env:
            child_env.update(env)
        self.log_path = server.dir / "client.log"
        self.log_file = open(self.log_path, "w", encoding="utf-8")
        self.proc = subprocess.Popen(
            [str(CLIENT_EXE), *args], cwd=str(CLIENT_DIR), env=child_env,
            stdout=self.log_file, stderr=subprocess.STDOUT,
        )
        wait_until(self._find_window, 25)
        return self

    def _find_window(self):
        found = []

        @ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)
        def cb(hwnd, _):
            pid = ctypes.c_ulong()
            user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
            if pid.value == self.proc.pid and user32.IsWindowVisible(hwnd):
                found.append(int(hwnd))
            return True

        user32.EnumWindows(cb, 0)
        if found:
            self.hwnd = found[0]
            return True
        return False

    def rect(self):
        class RECT(ctypes.Structure):
            _fields_ = [("l", ctypes.c_long), ("t", ctypes.c_long),
                        ("r", ctypes.c_long), ("b", ctypes.c_long)]

        r = RECT()
        user32.GetWindowRect(self.hwnd, ctypes.byref(r))
        return (r.l, r.t, r.r, r.b)

    def size(self):
        l, t, r, b = self.rect()
        return (r - l, b - t)

    def click(self, x, y):
        lp = (y << 16) | (x & 0xFFFF)
        user32.PostMessageW(self.hwnd, 0x0200, 0, lp)
        user32.PostMessageW(self.hwnd, 0x0201, 1, lp)
        user32.PostMessageW(self.hwnd, 0x0202, 0, lp)
        time.sleep(0.2)

    def type_text(self, text):
        # gpui membaca teks dari WM_KEYDOWN (bukan WM_CHAR) saat tanpa handler IME.
        for ch in text:
            vk = user32.VkKeyScanW(ord(ch)) & 0xFF
            user32.PostMessageW(self.hwnd, 0x0100, vk, 0x00000001)
            user32.PostMessageW(self.hwnd, 0x0101, vk, 0xC0000001)
            time.sleep(0.03)

    def press(self, vk):
        scan = user32.MapVirtualKeyW(vk, 0) << 16
        user32.PostMessageW(self.hwnd, 0x0100, vk, scan | 1)
        user32.PostMessageW(self.hwnd, 0x0101, vk, 0xC0000001 | scan)
        time.sleep(0.2)

    def visible(self):
        return bool(self.hwnd and user32.IsWindowVisible(self.hwnd))
    def close_window(self):
        """Jalur Alt+F4: WM_CLOSE ke window, bukan klik tombol."""
        user32.PostMessageW(self.hwnd, 0x0010, 0, 0)
        time.sleep(0.3)
    def cpu_percent(self, seconds=5.0):
        """CPU process (% dari satu core) selama jendela ukur; WARP = renderer di CPU."""
        class FT(ctypes.Structure):
            _fields_ = [("low", ctypes.c_uint32), ("high", ctypes.c_uint32)]
        class Times(ctypes.Structure):
            _fields_ = [("creation", FT), ("exit", FT), ("kernel", FT), ("user", FT)]
        kernel32 = ctypes.windll.kernel32
        handle = kernel32.OpenProcess(0x1000, False, self.proc.pid)
        try:
            def ticks():
                t = Times()
                kernel32.GetProcessTimes(handle, ctypes.byref(t.creation),
                                         ctypes.byref(t.exit), ctypes.byref(t.kernel),
                                         ctypes.byref(t.user))
                return (t.kernel.high << 32 | t.kernel.low) + (t.user.high << 32 | t.user.low)
            first = ticks()
            time.sleep(seconds)
            return round((ticks() - first) / (seconds * 1e7) * 100.0, 1)
        finally:
            kernel32.CloseHandle(handle)
    def working_set(self):
        class PMC(ctypes.Structure):
            _fields_ = [("cb", ctypes.c_uint32), ("PageFaultCount", ctypes.c_uint32),
                        ("PeakWorkingSetSize", ctypes.c_size_t),
                        ("WorkingSetSize", ctypes.c_size_t),
                        ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                        ("QuotaPagedPoolUsage", ctypes.c_size_t),
                        ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                        ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                        ("PagefileUsage", ctypes.c_size_t),
                        ("PeakPagefileUsage", ctypes.c_size_t)]
        info = PMC()
        info.cb = ctypes.sizeof(PMC)
        kernel32 = ctypes.windll.kernel32
        handle = kernel32.OpenProcess(0x1000, False, self.proc.pid)
        try:
            ok = ctypes.windll.psapi.GetProcessMemoryInfo(
                handle, ctypes.byref(info), ctypes.sizeof(PMC))
        finally:
            kernel32.CloseHandle(handle)
        return info.WorkingSetSize if ok else 0
    def shot(self, path):
        from PIL import Image
        w, h = self.size()
        gdi = ctypes.windll.gdi32
        hdc = user32.GetWindowDC(self.hwnd)
        mem = gdi.CreateCompatibleDC(hdc)
        bmp = gdi.CreateCompatibleBitmap(hdc, w, h)
        gdi.SelectObject(mem, bmp)
        user32.PrintWindow(self.hwnd, mem, 2)

        class BITMAPINFOHEADER(ctypes.Structure):
            _fields_ = [("biSize", ctypes.c_uint32), ("biWidth", ctypes.c_int32),
                        ("biHeight", ctypes.c_int32), ("biPlanes", ctypes.c_uint16),
                        ("biBitCount", ctypes.c_uint16), ("biCompression", ctypes.c_uint32),
                        ("biSizeImage", ctypes.c_uint32), ("biXPelsPerMeter", ctypes.c_int32),
                        ("biYPelsPerMeter", ctypes.c_int32), ("biClrUsed", ctypes.c_uint32),
                        ("biClrImportant", ctypes.c_uint32)]

        bi = BITMAPINFOHEADER()
        bi.biSize = ctypes.sizeof(BITMAPINFOHEADER)
        bi.biWidth, bi.biHeight = w, -h
        bi.biPlanes, bi.biBitCount = 1, 32
        buf = ctypes.create_string_buffer(w * h * 4)
        gdi.GetDIBits(mem, bmp, 0, h, buf, ctypes.byref(bi), 0)
        gdi.DeleteObject(bmp)
        gdi.DeleteDC(mem)
        user32.ReleaseDC(self.hwnd, hdc)
        img = Image.frombuffer("RGBA", (w, h), buf, "raw", "BGRA", 0, 1)
        img.save(path)
        return path

    def log_text(self):
        try:
            return self.log_path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            return ""

    def stop(self):
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(10)
            except subprocess.TimeoutExpired:
                self.proc.kill()
        if self.log_file:
            self.log_file.close()
            self.log_file = None
