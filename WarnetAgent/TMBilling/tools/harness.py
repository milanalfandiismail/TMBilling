"""Harness interaksi klien TMBilling (Windows, tanpa dependency baru).

Menjalankan server asli di latar, lalu klien dalam dua mode:
  --overlay demo untuk semua kontrol kartu overlay, kiosk nyata untuk form login.
Semua hasil disimpan sebagai PNG di X:\Temp\opencode\harness\.
"""
import argparse, ctypes, ctypes.wintypes as w, os, subprocess, sys, time
from PIL import Image

u = ctypes.windll.user32
g = ctypes.windll.gdi32
OUT = os.environ.get("TEMP_OUT", r"X:\Temp\opencode\harness")
os.makedirs(OUT, exist_ok=True)


class RECT(ctypes.Structure):
    _fields_ = [("l", ctypes.c_long), ("t", ctypes.c_long), ("r", ctypes.c_long), ("b", ctypes.c_long)]


class BMI(ctypes.Structure):
    _fields_ = [("biSize", ctypes.c_uint32), ("biWidth", ctypes.c_long), ("biHeight", ctypes.c_long),
                ("biPlanes", ctypes.c_uint16), ("biBitCount", ctypes.c_uint16), ("biCompression", ctypes.c_uint32),
                ("biSizeImage", ctypes.c_uint32), ("biXPelsPerMeter", ctypes.c_long),
                ("biYPelsPerMeter", ctypes.c_long), ("biClrUsed", ctypes.c_uint32), ("biClrImportant", ctypes.c_uint32)]


def rect(hwnd):
    r = RECT()
    u.GetWindowRect(hwnd, ctypes.byref(r))
    return r


def grab(hwnd):
    r = rect(hwnd)
    W, H = r.r - r.l, r.b - r.t
    hdc = u.GetWindowDC(hwnd)
    mdc = g.CreateCompatibleDC(hdc)
    bmp = g.CreateCompatibleBitmap(hdc, W, H)
    g.SelectObject(mdc, bmp)
    u.PrintWindow(hwnd, mdc, 2)
    bi = BMI(); bi.biSize = ctypes.sizeof(BMI); bi.biWidth = W; bi.biHeight = -H
    bi.biPlanes = 1; bi.biBitCount = 32
    buf = ctypes.create_string_buffer(W * H * 4)
    g.GetDIBits(mdc, bmp, 0, H, buf, ctypes.byref(bi), 0)
    return Image.frombuffer("RGBA", (W, H), buf, "raw", "BGRA", 0, 1).convert("RGB")


def find_window(pid, timeout=15.0):
    end = time.time() + timeout
    while time.time() < end:
        found = []

        @ctypes.WINFUNCTYPE(ctypes.c_bool, w.HWND, w.LPARAM)
        def cb(h, _):
            p = w.DWORD()
            u.GetWindowThreadProcessId(h, ctypes.byref(p))
            if p.value == pid and u.IsWindowVisible(h):
                found.append(h)
            return True

        u.EnumWindows(cb, 0)
        if found:
            return found[0]
        time.sleep(0.3)
    raise SystemExit("jendela klien tidak muncul")


def click_abs(hwnd, ax, ay, settle=1.4):
    r = rect(hwnd)
    u.SetCursorPos(r.l + ax, r.t + ay)
    u.mouse_event(2, 0, 0, 0, 0)
    u.mouse_event(4, 0, 0, 0, 0)
    time.sleep(settle)


def click(hwnd, fx, fy, settle=0.8):
    r = rect(hwnd)
    u.SetCursorPos(r.l + int((r.r - r.l) * fx), r.t + int((r.b - r.t) * fy))
    u.mouse_event(2, 0, 0, 0, 0)
    u.mouse_event(4, 0, 0, 0, 0)
    time.sleep(settle)


def key(hwnd, vk):
    u.PostMessageW(hwnd, 0x0100, vk, 0)
    time.sleep(0.2)
    u.PostMessageW(hwnd, 0x0101, vk, 0)
    time.sleep(0.8)


def accent_box(img, min_row=300):
    """Kotak accent terbesar per baris (tombol Masuk), mengabaikan underline tab."""
    w, h = img.size
    xs, ys = [], []
    for y in range(0, h, 2):
        row = []
        for x in range(0, w, 2):
            r, g, b = img.getpixel((x, y))
            if g > 170 and r < 110 and 140 < b < 200:
                row.append(x)
        if len(row) > min_row:
            xs += [row[0], row[-1]]; ys.append(y)
    if not xs:
        return None
    return min(xs), min(ys), max(xs), max(ys)


def white_pct(img, box=None):
    src = img.crop(box) if box else img
    px = list(src.getdata())
    return 100.0 * sum(1 for c in px if min(c) > 250) / max(1, len(px))


def start_client(exe, args, env_extra):
    env = dict(os.environ)
    env.update(env_extra)
    p = subprocess.Popen([exe] + args, env=env)
    hwnd = find_window(p.pid)
    time.sleep(1.5)
    return p, hwnd


def width(h):
    r = rect(h)
    return r.r - r.l


def overlay_suite(exe):
    cases = []
    p, h = start_client(exe, ["--overlay"], {"TM_DEV_SAFE": "1"})
    try:
        img = grab(h); cases.append(("overlay tampil kecil", width(h) < 500, "overlay_start.png", img))
        click(h, 0.75, 0.512)
        img = grab(h); cases.append(("klik Logout buka modal", width(h) > 1000, "overlay_logout.png", img))
        cx, cy = width(h) // 2, (rect(h).b - rect(h).t) // 2
        click_abs(h, cx + 45, cy + 50, 1.8)
        img = grab(h); cases.append(("Batal menutup modal", width(h) < 500, "overlay_batal.png", img))
        click(h, 0.25, 0.512)
        img = grab(h); cases.append(("klik Lock buka PIN", width(h) > 1000, "overlay_pin.png", img))
        key(h, 0x1B)
        img = grab(h); cases.append(("PIN bertahan saat Escape", width(h) > 1000, "overlay_pin_esc.png", img))
        p.terminate(); p, h = start_client(exe, ["--overlay"], {"TM_DEV_SAFE": "1"})
        click(h, 0.50, 0.775)
        img = grab(h); cases.append(("tab Alat tanpa layar putih", white_pct(img) < 3, "overlay_alat.png", img))
        click(h, 0.83, 0.775)
        img = grab(h); cases.append(("tab QRIS tanpa layar putih", white_pct(img) < 3, "overlay_qris.png", img))
    finally:
        p.terminate()
    return cases


def kiosk_suite(exe, server_url, api_key):
    cases = []
    p, h = start_client(exe, [], {"TM_DEV_SAFE": "1", "TM_SERVER_URL": server_url, "TM_CLIENT_KEY": api_key})
    try:
        img = grab(h); cases.append(("kiosk layar penuh", width(h) >= 1900, "kiosk.png", img))
        # form kosong: modal admin dipakai karena posisinya deterministik
        p.terminate(); p, h = start_client(exe, [], {"TM_DEV_SAFE": "1", "TM_SERVER_URL": server_url,
                                                     "TM_CLIENT_KEY": api_key, "TM_MODAL": "admin"})
        cx, cy = width(h) // 2, (rect(h).b - rect(h).t) // 2
        click_abs(h, cx + 184, cy + 120, 1.2)
        img = grab(h)
        red = sum(1 for r, g, b in img.getdata() if r > 180 and g < 90 and b < 90)
        cases.append(("Masuk kosong menampilkan galat", red > 200, "kiosk_error.png", img))
        key(h, 0x7A)
        img = grab(h); cases.append(("F11 tanpa crash", width(h) >= 1900, "kiosk_f11.png", img))
    finally:
        p.terminate()
    return cases


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--server", default=r"C:/Project GIT/TMBilling/app-rust/target/release/tmbilling-server.exe")
    ap.add_argument("--server-dir", default=r"C:/Project GIT/TMBilling/app-rust")
    ap.add_argument("--client", default=r"C:/Project GIT/TMBilling/WarnetAgent/TMBilling/target/debug/TMBilling.exe")
    ap.add_argument("--url", default="http://127.0.0.1:7015")
    ap.add_argument("--key", default=os.environ.get("TM_CLIENT_KEY", "TM2026"))
    ap.add_argument("--no-server", action="store_true")
    args = ap.parse_args()

    srv = None
    if not args.no_server:
        srv = subprocess.Popen([args.server], cwd=args.server_dir,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(3)
    results = []
    try:
        results += overlay_suite(args.client)
        results += kiosk_suite(args.client, args.url, args.key)
    finally:
        if srv:
            srv.terminate()

    ok = 0
    for name, passed, shot, img in results:
        img.save(os.path.join(OUT, shot))
        print(("LULUS " if passed else "GAGAL ") + name)
        ok += 1 if passed else 0
    print("\n%d/%d lulus, screenshot di %s" % (ok, len(results), OUT))
    return 0 if ok == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
