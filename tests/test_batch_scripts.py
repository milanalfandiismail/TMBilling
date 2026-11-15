import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent


def _read(name):
    return (ROOT / name).read_text(encoding="utf-8-sig").splitlines()


def test_skrip_instalasi_pindah_ke_folder_skrip():
    for name in ("install.bat", "developer_install.bat"):
        head = _read(name)[:12]
        assert any('cd /d "%~dp0"' in line for line in head), name


def test_perintah_kill_terbatas_pada_proyek_ini():
    for name, line_no in (("stop.bat", 25), ("install_scripts/updater.bat", 76)):
        line = _read(name)[line_no - 1]
        assert "$_.ExecutablePath" in line, name
        assert "%CD%" in line, name
