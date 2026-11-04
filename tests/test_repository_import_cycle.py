import subprocess
import sys


def test_repositories_can_be_imported_in_isolation_without_services():
    """Memastikan app.repositories dapat di-import langsung di clean Python interpreter
    tanpa terjadi ImportError atau Circular Import dari app.services."""
    cmd = [
        sys.executable,
        "-c",
        "import app.repositories; from app.repositories import ProcessRepository, SesiRepository; print('OK')"
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    assert proc.returncode == 0, f"Import gagal dengan error: {proc.stderr}"
    assert "OK" in proc.stdout
