import os
import re

UPDATER = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "install_scripts", "updater.bat")
)


def _read():
    with open(UPDATER, encoding="utf-8", errors="replace") as f:
        return f.read()


def test_updater_aborts_on_pip_or_migration_failure():
    text = _read()

    pip_start = text.index("-m pip install -r requirements.txt")
    pip_block = text[pip_start:text.index(":: 6.", pip_start)]
    assert "goto :fail" in pip_block
    assert "[WARN]" not in pip_block

    mig_start = text.index("install_scripts\\run_migration.py")
    mig_block = text[mig_start:text.index(":restart_server", mig_start)]
    assert "goto :fail" in mig_block
    assert "[WARN]" not in mig_block


def test_dependency_install_always_runs_with_selected_python():
    """pip wajib dijalankan lewat interpreter terpilih, bukan hanya bila pip.exe ada."""
    text = _read()
    assert '"%TM_PY%" -m pip install -r requirements.txt --quiet' in text
    assert '".venv\\Scripts\\pip.exe" install' not in text


def test_updater_claims_single_flight_and_releases_on_exit():
    text = _read()
    claim = text.index('update_claim.py" claim')
    release = text.index('update_claim.py" release')
    assert claim < release
    assert 'exit /b %TM_EXIT%' in text


def test_update_bat_claims_before_overwriting_package():
    """update.bat tidak boleh menimpa paket ZIP sebelum klaim didapat."""
    path = os.path.abspath(os.path.join(os.path.dirname(UPDATER), "..", "update.bat"))
    with open(path, encoding="utf-8", errors="replace") as f:
        text = f.read()

    claim = text.index('update_claim.py" claim')
    copy = text.index('copy /y "%~1" "instance\\temp_update.zip"')
    assert claim < copy


def test_fail_path_does_not_start_server():
    text = _read()
    fail_section = text[re.search(r"^:fail\s*$", text, re.M).start():]

    assert 'start ""' not in fail_section
    assert "TM_EXIT=1" in fail_section
