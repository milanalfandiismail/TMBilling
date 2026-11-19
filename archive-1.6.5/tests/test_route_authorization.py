"""Pagar otorisasi: setiap route wajib punya penjagaan yang terlihat.

Route baru tanpa decorator penjagaan akan gagal di sini. Bila memang publik,
daftarkan nama fungsinya di PUBLIC beserta alasannya.
"""

import re
from pathlib import Path

ROUTES_DIR = Path(__file__).resolve().parents[1] / "app" / "routes"
GUARDS = ("login_required", "admin_required", "shift_required", "api_key_required")
ROUTE_LINE = re.compile(r"^\s*@\w+\.route\(")
DECORATOR_LINE = re.compile(r"^\s*@")
DEF_LINE = re.compile(r"^\s*def\s+(\w+)")

# Route yang memang dapat diakses tanpa sesi kasir.
PUBLIC = {
    "login": "halaman form login kasir",
    "check_session": "memeriksa status login; hasilnya sendiri berupa logged_in",
    "admin_check": "memeriksa kredensial admin sebelum login",
    "login_page": "halaman login portal",
    "login_action": "proses login portal member",
    "logout_action": "logout portal member, cukup menghapus sesi",
    "public_pc_status": "status PC untuk kiosk member, data sudah disamarkan",
    "get_public_games": "katalog game publik",
    "get_public_kategori": "kategori game publik",
    "health": "health check publik tanpa angka/path",
    "get_tv_data": "billboard TV publik",
}


def _route_functions():
    """Kumpulkan (nama_fungsi, berkas, baris, teks_decorator, isi_dekorator_dalam)."""
    hasil = []
    for path in sorted(ROUTES_DIR.rglob("*.py")):
        lines = path.read_text(encoding="utf-8-sig").splitlines()
        for idx, line in enumerate(lines):
            if not ROUTE_LINE.match(line):
                continue
            decorators = []
            j = idx
            while j < len(lines) and not DEF_LINE.match(lines[j]):
                if DECORATOR_LINE.match(lines[j]):
                    decorators.append(lines[j].strip())
                j += 1
            if j >= len(lines):
                continue
            nama = DEF_LINE.match(lines[j]).group(1)
            # Guard juga sah bila dipasang sebagai wrapper di dalam fungsi.
            dalam = "\n".join(lines[j : j + 12])
            hasil.append((nama, str(path), j + 1, " ".join(decorators), dalam))
    return hasil


def test_setiap_route_punya_penjagaan():
    pelanggar = []
    for nama, path, baris, dekorator, dalam in _route_functions():
        if any(guard in dekorator for guard in GUARDS):
            continue
        if any("@" + guard in dalam for guard in GUARDS):
            continue
        if nama in PUBLIC:
            continue
        pelanggar.append(f"{path}:{baris} {nama}")

    assert not pelanggar, "Route tanpa penjagaan dan tidak terdaftar publik:\n" + "\n".join(pelanggar)


def test_publik_terdaftar_masih_ada():
    ada = {nama for nama, *_ in _route_functions()}
    yatim = sorted(set(PUBLIC) - ada)
    assert not yatim, f"Entri PUBLIC menunjuk fungsi yang sudah tidak ada: {yatim}"


def test_publik_punya_alasan():
    tanpa_alasan = [nama for nama, alasan in PUBLIC.items() if len(alasan.strip()) < 8]
    assert not tanpa_alasan, f"Entri PUBLIC tanpa alasan jelas: {tanpa_alasan}"
