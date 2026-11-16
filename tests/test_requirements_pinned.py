from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIREMENTS = ROOT / "requirements.txt"


def _lines():
    return [l.strip() for l in REQUIREMENTS.read_text(encoding="utf-8").splitlines() if l.strip() and not l.startswith("#")]


def test_semua_dependensi_dipin_eksak():
    for line in _lines():
        assert "==" in line, f"pin tidak eksak: {line}"
        assert all(c not in line for c in (">=", "<=", "~=", ">", "<")), f"pin mengambang: {line}"


def test_versi_aman_terpasang():
    text = REQUIREMENTS.read_text(encoding="utf-8")
    for pin in ("Pillow==13.0.0", "certifi==2026.10.23", "urllib3==2.8.0", "Mako==1.4.3"):
        assert pin in text, f"pin belum ada: {pin}"

