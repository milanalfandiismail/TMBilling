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


def test_update_bat_berjalan_dari_salinan_temp():
    lines = _read("update.bat")
    guard = next(i for i, l in enumerate(lines) if 'if defined TM_UPDATE_SELF' in l)
    copy = next(i for i, l in enumerate(lines) if 'copy /y "%~f0"' in l)
    call = next(i for i, l in enumerate(lines) if 'call "%TM_SELF_COPY%"' in l)
    claim = next(i for i, l in enumerate(lines) if 'update_claim.py" claim' in l)
    assert guard < copy < call < claim
    assert next(i for i, l in enumerate(lines) if l.strip() == ':siap_update') > call
