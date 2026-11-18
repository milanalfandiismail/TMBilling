import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
APP = (REPO / "app-rust" / "src" / "app.rs").read_text(encoding="utf-8")
MATRIX = Path(__file__).with_name("endpoint_matrix.md").read_text(encoding="utf-8")


def test_semua_rute_klien_terdokumentasi():
    paths = set(re.findall(r'"(/api/v1/public/client/[a-z_\-]+)"', APP))
    paths |= set(re.findall(r'"(/api/v1/public/monitor[a-z/_\-]*)"', APP))
    assert paths, "tidak ada rute klien ditemukan di app.rs"
    hilang = sorted(p for p in paths if p not in MATRIX)
    assert hilang == [], hilang
