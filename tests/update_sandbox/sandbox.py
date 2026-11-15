import os
import shutil
import subprocess
import zipfile
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
PY = REPO / '.venv' / 'Scripts' / 'python.exe'
SYS32 = Path(os.environ.get('SystemRoot', 'C:/Windows')) / 'System32'
CMD = os.environ.get('ComSpec') or str(SYS32 / 'cmd.exe')
PS = str(SYS32 / 'WindowsPowerShell' / 'v1.0' / 'powershell.exe')


def _fake_zip(path, dengan_verify=True):
    with zipfile.ZipFile(path, 'w') as z:
        z.writestr('run.py', 'pass')
        z.writestr('app/config.py', 'VERSION = "9.9.9"')
        z.writestr('requirements.txt', '')
        z.writestr('install_scripts/update_claim.py', (REPO / 'install_scripts' / 'update_claim.py').read_text(encoding='utf-8'))
        z.writestr('install_scripts/run_migration.py', 'open("migration_marker.txt", "w").close()')
        if dengan_verify:
            z.writestr('install_scripts/verify_versions.py', 'raise SystemExit(0)')
        z.writestr('.env', '# DARI_PAKET')
        z.writestr('.env.example', '# CONTOH_BARU')


def build_sandbox(tmp_path, zip_mode='instance', dengan_verify=True):
    root = tmp_path / 'server'
    root.mkdir()
    shutil.copy2(REPO / 'update.bat', root / 'update.bat')
    shutil.copytree(REPO / 'install_scripts', root / 'install_scripts')
    (root / 'instance').mkdir()
    (root / '.env').write_text('# LOKAL', encoding='utf-8')
    # Shim python: launcher + pyvenv.cfg agar preflight batch lolos tanpa venv nyata.
    (root / '.venv' / 'Scripts').mkdir(parents=True)
    shutil.copy2(PY, root / '.venv' / 'Scripts' / 'python.exe')
    shutil.copy2(PY, root / '.venv' / 'Scripts' / 'pythonw.exe')
    shutil.copy2(REPO / '.venv' / 'pyvenv.cfg', root / '.venv' / 'pyvenv.cfg')
    # Shim pip: batch memanggil `python -m pip install`, cukup exit 0 tanpa jaringan.
    pip_dir = root / '.venv' / 'Lib' / 'site-packages' / 'pip'
    pip_dir.mkdir(parents=True)
    (pip_dir / '__init__.py').write_text('', encoding='utf-8')
    (pip_dir / '__main__.py').write_text('raise SystemExit(0)', encoding='utf-8')
    pkg = tmp_path / 'pkg.zip'
    _fake_zip(pkg, dengan_verify)
    if zip_mode == 'instance':
        shutil.copy2(pkg, root / 'instance' / 'temp_update.zip')
    return root, pkg


def _server_produksi_hidup():
    probe = subprocess.run(
        [PS, '-NoProfile', '-Command',
         'Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq "python.exe" -or $_.Name -eq "pythonw.exe") -and $_.CommandLine -like "*run.py*" }'],
        capture_output=True, text=True,
    )
    return bool(probe.stdout.strip())


def run_update_bat(root, args=()):
    if _server_produksi_hidup():
        pytest.skip('server produksi sedang berjalan; test akan membunuhnya')
    env = os.environ.copy()
    # TM_PY sengaja TIDAK disuntik: batch harus memakai default .venv sendiri.
    env.update({'TM_UPDATE_ROOT': str(root), 'TM_PORT': '7099'})
    env['PATH'] = os.pathsep.join([str(SYS32), str(SYS32 / 'WindowsPowerShell' / 'v1.0'), env.get('PATH', '')])
    env.pop('TM_UPDATER_COPY', None)
    env.pop('TM_CLAIM_HELD', None)
    return subprocess.run(
        [CMD, '/c', 'update.bat', *args],
        cwd=root, env=env, capture_output=True, text=True, timeout=180,
    )


def assert_clean(res, root):
    assert res.returncode == 0, res.stdout + res.stderr
    assert 'Pembaruan lain sedang berjalan' not in res.stdout
    assert (root / 'migration_marker.txt').exists()
    assert '[OK] Server TMBilling' in res.stdout
    assert not (root / 'instance' / 'update.lock').exists()
    assert not (root / 'instance' / 'staging_update').exists()
    assert (root / '.env').read_text(encoding='utf-8') == '# LOKAL'
    assert (root / '.env.example').read_text(encoding='utf-8') == '# CONTOH_BARU'