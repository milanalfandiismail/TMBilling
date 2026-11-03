"""Sandbox Server Manager untuk Pengujian End-to-End (E2E).

Modul ini bertanggung jawab untuk:
1. Mempersiapkan database SQLite sementara `instance/warnet_e2e_sandbox.db`.
2. Mengisi data awal via `seed_sandbox()`.
3. Menjalankan server Flask terisolasi pada port khusus (default: 7016) via subprocess.
4. Mematikan server dan menghapus database sementara secara bersih tanpa mencemari `instance/warnet.db`.
"""

import os
import sys
import time
import subprocess
import urllib.request
import urllib.error

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

INSTANCE_DIR = os.path.join(PROJECT_ROOT, "instance")
SANDBOX_DB_NAME = "warnet_e2e_sandbox.db"
SANDBOX_DB_PATH = os.path.join(INSTANCE_DIR, SANDBOX_DB_NAME)


def prepare_sandbox_database():
    """Hapus database lama jika ada dan buat database fresh dengan data seeder."""
    os.makedirs(INSTANCE_DIR, exist_ok=True)
    
    # Inisialisasi DB menggunakan Flask App Context
    os.environ["DATABASE_URL"] = f"sqlite:///{SANDBOX_DB_PATH.replace(os.sep, '/')}"
    os.environ["FLASK_ENV"] = "testing"
    os.environ["TESTING"] = "1"

    if os.path.exists(SANDBOX_DB_PATH):
        try:
            os.remove(SANDBOX_DB_PATH)
        except OSError:
            pass

    from app import create_app
    from app.models import db
    from tests.e2e.seed_e2e_data import seed_sandbox

    app = create_app()
    seed_sandbox(app)
    with app.app_context():
        db.engine.dispose()
    print(f"[E2E SANDBOX] Database sandbox berhasil disiapkan: {SANDBOX_DB_PATH}")


def start_sandbox_server(port=7016, timeout_sec=20):
    """Mempersiapkan database dan menjalankan server Flask di subprocess."""
    prepare_sandbox_database()

    python_exe = sys.executable
    server_script = os.path.join(os.path.dirname(__file__), "sandbox_app_runner.py")

    # Buat runner script jika belum ada
    if not os.path.exists(server_script):
        with open(server_script, "w", encoding="utf-8") as f:
            f.write(f'''# Auto-generated sandbox runner
import os
import sys
project_root = r"{PROJECT_ROOT}"
if project_root not in sys.path:
    sys.path.insert(0, project_root)

db_path = r"{SANDBOX_DB_PATH}"
os.environ["DATABASE_URL"] = f"sqlite:///{{db_path.replace(os.sep, '/')}}"
os.environ["FLASK_ENV"] = "testing"
os.environ["TESTING"] = "1"

from app import create_app
app = create_app()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 7016
    from waitress import serve
    serve(app, host="127.0.0.1", port=port, threads=6)
''')

    env = os.environ.copy()
    env["PYTHONPATH"] = PROJECT_ROOT
    env["DATABASE_URL"] = f"sqlite:///{SANDBOX_DB_PATH.replace(os.sep, '/')}"
    env["FLASK_ENV"] = "testing"
    env["TESTING"] = "1"

    proc = subprocess.Popen(
        [python_exe, server_script, str(port)],
        cwd=PROJECT_ROOT,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    # Health check loop
    url = f"http://127.0.0.1:{port}/kasir/login"
    start_time = time.time()
    server_ready = False

    while time.time() - start_time < timeout_sec:
        if proc.poll() is not None:
            stderr = proc.stderr.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"[E2E SANDBOX] Server gagal startup: {stderr}")
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=2) as resp:
                if resp.status == 200:
                    server_ready = True
                    break
        except (urllib.error.URLError, ConnectionRefusedError, OSError):
            time.sleep(0.5)

    if not server_ready:
        stop_sandbox_server(proc, SANDBOX_DB_PATH)
        raise TimeoutError(f"[E2E SANDBOX] Server tidak responsif dalam {timeout_sec} detik pada port {port}")

    print(f"[E2E SANDBOX] Server aktif pada http://127.0.0.1:{port} (PID: {proc.pid})")
    return proc, SANDBOX_DB_PATH


def stop_sandbox_server(proc, db_path=SANDBOX_DB_PATH):
    """Menghentikan subprocess server dan menghapus file database sementara."""
    if proc:
        print(f"[E2E SANDBOX] Menghentikan server PID {proc.pid}...")
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()

    time.sleep(0.5)

    # Bersihkan file database sementara
    if db_path and os.path.exists(db_path):
        for _ in range(5):
            try:
                os.remove(db_path)
                print(f"[E2E SANDBOX] Database sementara {db_path} berhasil dihapus.")
                break
            except OSError:
                time.sleep(0.5)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--standalone":
        port = int(sys.argv[2]) if len(sys.argv) > 2 else 7016
        proc, db_p = start_sandbox_server(port)
        try:
            print(f"Tekan Ctrl+C untuk menghentikan server sandbox...")
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            stop_sandbox_server(proc, db_p)
