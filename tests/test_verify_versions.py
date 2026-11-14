import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "install_scripts"))

from verify_versions import mismatches


def _tulis(tmp_path, baris):
    req = tmp_path / "requirements.txt"
    req.write_text(chr(10).join(baris) + chr(10), encoding="utf-8")
    return req


def test_selisih_terdeteksi(tmp_path):
    req = _tulis(tmp_path, ["Flask==3.1.3", "Pillow==13.0.0"])
    hasil = mismatches(req, installed={"Flask": "3.1.2", "Pillow": "13.0.0"})
    assert hasil == ["Flask==3.1.3 (terpasang 3.1.2)"]


def test_paket_hilang_terdeteksi(tmp_path):
    req = _tulis(tmp_path, ["Flask==3.1.3"])
    assert mismatches(req, installed={}) == ["Flask==3.1.3 (tidak terpasang)"]


def test_semua_cocok(tmp_path):
    req = _tulis(tmp_path, ["Flask==3.1.3"])
    assert mismatches(req, installed={"Flask": "3.1.3"}) == []

