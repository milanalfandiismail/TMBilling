from pathlib import Path

BAT = Path(__file__).resolve().parents[1] / "install.bat"


def _baris():
    return BAT.read_text(encoding="utf-8", errors="replace").splitlines()


def test_init_db_error_menghentikan_instalasi():
    baris = _baris()
    idx = [i for i, b in enumerate(baris) if "init_db.py" in b][0]
    berikut = [b.strip() for b in baris[idx + 1: idx + 4] if b.strip()]
    assert berikut and berikut[0].startswith("if errorlevel 1")

    label = [i for i, b in enumerate(baris) if b.strip() == ":db_error"][0]
    isi = " ".join(b.strip() for b in baris[label: label + 6])
    assert "exit /b 1" in isi


def test_pip_dipanggil_lewat_interpreter():
    teks = BAT.read_text(encoding="utf-8", errors="replace")
    assert "-m pip install -r requirements.txt" in teks
    assert "Scripts" + chr(92) + "pip install -r requirements.txt" not in teks
