import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent


def _read(name):
    return (ROOT / name).read_text(encoding="utf-8-sig").splitlines()


def test_skrip_instalasi_pindah_ke_folder_skrip():
    for name in ("install.bat", "developer_install.bat"):
        head = _read(name)[:12]
        assert any('cd /d "%~dp0"' in line for line in head), name
