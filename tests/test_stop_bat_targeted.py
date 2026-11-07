from pathlib import Path


def test_stop_bat_tidak_membunuh_semua_pythonw():
    text = (Path(__file__).resolve().parents[1] / "stop.bat").read_text(encoding="utf-8")
    assert "taskkill /f /im pythonw.exe" not in text.lower()
    assert "*run.py*" in text
    assert "7015" in text
