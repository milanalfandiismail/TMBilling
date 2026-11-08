from pathlib import Path


def test_updater_tidak_membunuh_semua_pythonw():
    root = Path(__file__).resolve().parents[1]
    teks = (root / "install_scripts" / "updater.bat").read_text(encoding="utf-8")

    assert "taskkill /f /im pythonw.exe" not in teks.lower()
    assert "*run.py*" in teks
