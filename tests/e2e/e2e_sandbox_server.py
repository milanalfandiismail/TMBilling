"""Sandbox Server Manager untuk Pengujian End-to-End (E2E).

Modul ini bertanggung jawab untuk:
1. Mempersiapkan database SQLite sementara `instance/warnet_e2e_sandbox.db`.
2. Mengisi data awal via `seed_sandbox()`.
3. Menjalankan server Flask terisolasi pada port khusus (default: 7016) via `waitress`.
4. Mematikan server dan menghapus database sementara secara bersih tanpa mencemari `instance/warnet.db`.

Catatan desain:
- Server dijalankan langsung sebagai `python -m waitress --call app:create_app`,
  jadi tidak ada lagi berkas runner yang di-generate otomatis.
- Proses anak dimasukkan ke Windows Job Object dengan flag KILL_ON_JOB_CLOSE.
  Jika proses induk mati mendadak (Ctrl+C, Stop-Process -Force, atau tab terminal
  ditutup), Windows ikut mematikan proses anak sehingga port 7016 tidak tersandera.
"""

import ctypes
import os
import socket
import sys
import time
import subprocess
import urllib.request
import urllib.error
from ctypes import wintypes

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

INSTANCE_DIR = os.path.join(PROJECT_ROOT, "instance")
SANDBOX_DB_NAME = "warnet_e2e_sandbox.db"
SANDBOX_DB_PATH = os.path.join(INSTANCE_DIR, SANDBOX_DB_NAME)
SANDBOX_LOG_PATH = os.path.join(INSTANCE_DIR, "e2e_sandbox_server.log")

# Kredensial tetap supaya suite tidak bergantung pada isi .env mesin pengembang.
SANDBOX_CLIENT_API_KEY = "e2e-client-key"
SANDBOX_SECRET_KEY = "e2e-secret"

# Handle job harus tetap hidup selama induk berjalan; jika di-GC, handle ditutup
# dan Windows langsung membunuh server sandbox.
_JOB_HANDLES = []

_JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000
_JOB_OBJECT_EXTENDED_LIMIT_INFORMATION = 9
_PROCESS_SET_QUOTA = 0x0100
_PROCESS_TERMINATE = 0x0001


class _JobBasicLimitInformation(ctypes.Structure):
    _fields_ = [
        ("PerProcessUserTimeLimit", ctypes.c_int64),
        ("PerJobUserTimeLimit", ctypes.c_int64),
        ("LimitFlags", wintypes.DWORD),
        ("MinimumWorkingSetSize", ctypes.c_size_t),
        ("MaximumWorkingSetSize", ctypes.c_size_t),
        ("ActiveProcessLimit", wintypes.DWORD),
        ("Affinity", ctypes.c_size_t),
        ("PriorityClass", wintypes.DWORD),
        ("SchedulingClass", wintypes.DWORD),
    ]


class _IoCounters(ctypes.Structure):
    _fields_ = [
        ("ReadOperationCount", ctypes.c_uint64),
        ("WriteOperationCount", ctypes.c_uint64),
        ("OtherOperationCount", ctypes.c_uint64),
        ("ReadTransferCount", ctypes.c_uint64),
        ("WriteTransferCount", ctypes.c_uint64),
        ("OtherTransferCount", ctypes.c_uint64),
    ]


class _JobExtendedLimitInformation(ctypes.Structure):
    _fields_ = [
        ("BasicLimitInformation", _JobBasicLimitInformation),
        ("IoInfo", _IoCounters),
        ("ProcessMemoryLimit", ctypes.c_size_t),
        ("JobMemoryLimit", ctypes.c_size_t),
        ("PeakProcessMemoryUsed", ctypes.c_size_t),
        ("PeakJobMemoryUsed", ctypes.c_size_t),
    ]


def _attach_kill_on_close_job(proc):
    """Ikat proses anak ke job object yang membunuhnya saat induk mati."""
    if sys.platform != "win32":
        return False

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.CreateJobObjectW.restype = wintypes.HANDLE
    kernel32.CreateJobObjectW.argtypes = [wintypes.LPVOID, wintypes.LPCWSTR]
    kernel32.SetInformationJobObject.argtypes = [
        wintypes.HANDLE,
        ctypes.c_int,
        wintypes.LPVOID,
        wintypes.DWORD,
    ]
    kernel32.OpenProcess.restype = wintypes.HANDLE
    kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel32.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]

    job = kernel32.CreateJobObjectW(None, None)
    if not job:
        return False

    info = _JobExtendedLimitInformation()
    info.BasicLimitInformation.LimitFlags = _JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
    if not kernel32.SetInformationJobObject(
        job, _JOB_OBJECT_EXTENDED_LIMIT_INFORMATION, ctypes.byref(info), ctypes.sizeof(info)
    ):
        kernel32.CloseHandle(job)
        return False

    proc_handle = kernel32.OpenProcess(_PROCESS_SET_QUOTA | _PROCESS_TERMINATE, False, proc.pid)
    if not proc_handle:
        kernel32.CloseHandle(job)
        return False

    assigned = bool(kernel32.AssignProcessToJobObject(job, proc_handle))
    kernel32.CloseHandle(proc_handle)
    if not assigned:
        kernel32.CloseHandle(job)
        return False

    _JOB_HANDLES.append(job)
    return True


def _port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def _read_server_log():
    try:
        with open(SANDBOX_LOG_PATH, "r", encoding="utf-8", errors="replace") as fh:
            return fh.read()[-2000:].strip()
    except OSError:
        return ""


def _sandbox_env():
    env = os.environ.copy()
    env["PYTHONPATH"] = PROJECT_ROOT
    env["DATABASE_URL"] = "sqlite:///{}".format(SANDBOX_DB_PATH.replace(os.sep, "/"))
    env["FLASK_ENV"] = "testing"
    env["TESTING"] = "1"
    env["CLIENT_API_KEY"] = SANDBOX_CLIENT_API_KEY
    env["SECRET_KEY"] = SANDBOX_SECRET_KEY
    return env


def prepare_sandbox_database():
    """Hapus database lama jika ada dan buat database fresh dengan data seeder."""
    os.makedirs(INSTANCE_DIR, exist_ok=True)

    env = _sandbox_env()
    os.environ["DATABASE_URL"] = env["DATABASE_URL"]
    os.environ["FLASK_ENV"] = "testing"
    os.environ["TESTING"] = "1"
    os.environ["CLIENT_API_KEY"] = SANDBOX_CLIENT_API_KEY
    os.environ["SECRET_KEY"] = SANDBOX_SECRET_KEY

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
    if _port_in_use(port):
        raise RuntimeError(
            f"[E2E SANDBOX] Port {port} sudah dipakai proses lain; hentikan dulu sebelum memulai sandbox."
        )

    prepare_sandbox_database()

    cmd = [
        sys.executable,
        "-m",
        "waitress",
        "--call",
        "--host=127.0.0.1",
        f"--port={port}",
        "app:create_app",
    ]

    # Log ke berkas, bukan PIPE: PIPE yang tidak dibaca bisa memblokir server
    # ketika suite panjang menghasilkan banyak output.
    with open(SANDBOX_LOG_PATH, "w", encoding="utf-8") as log:
        proc = subprocess.Popen(
            cmd,
            cwd=PROJECT_ROOT,
            env=_sandbox_env(),
            stdout=log,
            stderr=subprocess.STDOUT,
        )

    if not _attach_kill_on_close_job(proc):
        print("[E2E SANDBOX] Peringatan: job object gagal dipasang (proses anak tidak auto-mati saat induk berhenti).")

    # Health check loop
    url = f"http://127.0.0.1:{port}/kasir/login"
    start_time = time.time()
    server_ready = False

    while time.time() - start_time < timeout_sec:
        if proc.poll() is not None:
            raise RuntimeError(
                "[E2E SANDBOX] Server gagal startup (exit {}): {}".format(proc.returncode, _read_server_log())
            )
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
        raise TimeoutError(
            f"[E2E SANDBOX] Server tidak responsif dalam {timeout_sec} detik pada port {port}. "
            f"Log terakhir: {_read_server_log()}"
        )

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
            print("Tekan Ctrl+C untuk menghentikan server sandbox...")
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            stop_sandbox_server(proc, db_p)
