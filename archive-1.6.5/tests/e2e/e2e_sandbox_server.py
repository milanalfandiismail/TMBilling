"""Sandbox Server Manager untuk Pengujian End-to-End (E2E).

Modul ini bertanggung jawab untuk:
1. Mempersiapkan database SQLite sementara per suite (`instance/e2e/<suite>/warnet.db`).
2. Mengisi data awal via `seed_sandbox()`.
3. Menjalankan server Flask terisolasi pada port khusus via `waitress`.
4. Mematikan server dan menghapus database sementara secara bersih tanpa mencemari `instance/warnet.db`.

Catatan desain:
- Server dijalankan langsung sebagai `python -m waitress --call app:create_app`,
  jadi tidak ada lagi berkas runner yang di-generate otomatis.
- Proses anak dimasukkan ke Windows Job Object dengan flag KILL_ON_JOB_CLOSE.
  Jika proses induk mati mendadak (Ctrl+C, Stop-Process -Force, atau tab terminal
  ditutup), Windows ikut mematikan proses anak sehingga port 7016 tidak tersandera.
"""

import ctypes
import json
import os
import re
import socket
import shutil
import sys
import time
import subprocess
import urllib.request
import urllib.error
from ctypes import wintypes
from dataclasses import dataclass

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

INSTANCE_DIR = os.path.join(PROJECT_ROOT, "instance")
SANDBOX_DB_NAME = "warnet_e2e_sandbox.db"
SANDBOX_DB_PATH = os.path.join(INSTANCE_DIR, SANDBOX_DB_NAME)
SANDBOX_LOG_PATH = os.path.join(INSTANCE_DIR, "e2e_sandbox_server.log")
# Catatan & bootstrap admin sandbox dipisah agar tidak menyentuh berkas produksi.
SANDBOX_NOTES_DIR = os.path.join(INSTANCE_DIR, "e2e", "notes")
SANDBOX_PROJECT_ROOT = os.path.join(INSTANCE_DIR, "e2e", "root")
# Backup sandbox dipisah agar suite tidak menulis/memangkas isi backups/ produksi.
SANDBOX_BACKUP_DIR = os.path.join(INSTANCE_DIR, "e2e", "backups")


@dataclass(frozen=True)
class SandboxPaths:
    db_path: str
    notes_dir: str
    project_root: str
    backup_dir: str
    instance_dir: str
    log_path: str

    @property
    def routes_path(self):
        return os.path.join(os.path.dirname(self.db_path), "routes.json")

    @property
    def temp_dir(self):
        # TEMP/TMP per suite: restore & update memakai tempfile, jangan ikut disk global.
        return os.path.join(os.path.dirname(self.db_path), "tmp")


DEFAULT_PATHS = SandboxPaths(
    db_path=SANDBOX_DB_PATH,
    notes_dir=SANDBOX_NOTES_DIR,
    project_root=SANDBOX_PROJECT_ROOT,
    backup_dir=SANDBOX_BACKUP_DIR,
    instance_dir=os.path.join(INSTANCE_DIR, "e2e", "instance"),
    log_path=SANDBOX_LOG_PATH,
)


def sandbox_paths(suite_id):
    if not re.fullmatch(r"[a-z0-9_]+", suite_id or ""):
        raise ValueError("suite_id hanya boleh huruf kecil, angka, dan garis bawah")
    root = os.path.join(INSTANCE_DIR, "e2e", suite_id)
    return SandboxPaths(
        db_path=os.path.join(root, "warnet.db"),
        notes_dir=os.path.join(root, "notes"),
        project_root=os.path.join(root, "root"),
        backup_dir=os.path.join(root, "backups"),
        instance_dir=os.path.join(root, "instance"),
        log_path=os.path.join(root, "server.log"),
    )


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


def _read_server_log(paths=DEFAULT_PATHS):
    try:
        with open(paths.log_path, "r", encoding="utf-8", errors="replace") as fh:
            return fh.read()[-2000:].strip()
    except OSError:
        return ""


def _sandbox_env(paths=DEFAULT_PATHS):
    env = os.environ.copy()
    env["PYTHONPATH"] = PROJECT_ROOT
    env["DATABASE_URL"] = "sqlite:///{}".format(paths.db_path.replace(os.sep, "/"))
    env["FLASK_ENV"] = "testing"
    env["TESTING"] = "1"
    env["CLIENT_API_KEY"] = SANDBOX_CLIENT_API_KEY
    env["SECRET_KEY"] = SANDBOX_SECRET_KEY
    env["TM_NOTES_DIR"] = paths.notes_dir
    env["PROJECT_ROOT"] = paths.project_root
    env["BACKUP_DIR"] = paths.backup_dir
    env["E2E_INSTANCE_PATH"] = paths.instance_dir
    # Log rute dipakai gerbang cakupan E2E; satu berkas per suite.
    env["E2E_API_LOG"] = os.path.join(os.path.dirname(paths.db_path), "requests.log")
    env["TEMP"] = env["TMP"] = paths.temp_dir
    return env


def prepare_sandbox_database(paths=DEFAULT_PATHS):
    """Hapus database lama jika ada dan buat database fresh dengan data seeder."""
    os.makedirs(INSTANCE_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(paths.db_path), exist_ok=True)

    env = _sandbox_env(paths)
    os.environ["DATABASE_URL"] = env["DATABASE_URL"]
    os.environ["FLASK_ENV"] = "testing"
    os.environ["TESTING"] = "1"
    os.environ["CLIENT_API_KEY"] = SANDBOX_CLIENT_API_KEY
    os.environ["SECRET_KEY"] = SANDBOX_SECRET_KEY
    os.environ["TM_NOTES_DIR"] = paths.notes_dir
    os.environ["PROJECT_ROOT"] = paths.project_root
    os.environ["BACKUP_DIR"] = paths.backup_dir
    os.environ["E2E_INSTANCE_PATH"] = paths.instance_dir

    for sandbox_only in (paths.notes_dir, paths.project_root, paths.backup_dir, paths.instance_dir, paths.temp_dir):
        if os.path.isdir(sandbox_only):
            shutil.rmtree(sandbox_only, ignore_errors=True)
        os.makedirs(sandbox_only, exist_ok=True)

    for suffix in ("", "-wal", "-shm"):
        try:
            os.remove(paths.db_path + suffix)
        except OSError:
            pass

    from app.models import db
    from tests.e2e.sandbox_app import create_app
    from tests.e2e.seed_e2e_data import seed_sandbox

    app = create_app()
    routes = sorted(
        f"{rule.endpoint} {sorted(rule.methods - {'HEAD', 'OPTIONS'})[0]}"
        for rule in app.url_map.iter_rules()
    )
    with open(paths.routes_path, "w", encoding="utf-8") as fh:
        json.dump(routes, fh, indent=2)
    seed_sandbox(app)
    with app.app_context():
        db.engine.dispose()
    print(f"[E2E SANDBOX] Database sandbox berhasil disiapkan: {paths.db_path}")


def start_sandbox_server(port=7016, paths=DEFAULT_PATHS, timeout_sec=20):
    """Mempersiapkan database dan menjalankan server Flask di subprocess."""
    if _port_in_use(port):
        raise RuntimeError(
            f"[E2E SANDBOX] Port {port} sudah dipakai proses lain; hentikan dulu sebelum memulai sandbox."
        )

    prepare_sandbox_database(paths)

    cmd = [
        sys.executable,
        "-m",
        "waitress",
        "--call",
        "--host=127.0.0.1",
        f"--port={port}",
        # Uji E2E mensimulasikan PC klien lewat header X-Forwarded-For dari
        # loopback; waitress tanpa trusted-proxy membuang header itu.
        "--trusted-proxy=127.0.0.1",
        "--trusted-proxy-headers=x-forwarded-for",
        "tests.e2e.sandbox_app:create_app",
    ]

    # Log ke berkas, bukan PIPE: PIPE yang tidak dibaca bisa memblokir server
    # ketika suite panjang menghasilkan banyak output.
    with open(paths.log_path, "w", encoding="utf-8") as log:
        proc = subprocess.Popen(
            cmd,
            cwd=PROJECT_ROOT,
            env=_sandbox_env(paths),
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
                "[E2E SANDBOX] Server gagal startup (exit {}): {}".format(
                    proc.returncode, _read_server_log(paths)
                )
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
        stop_sandbox_server(proc, paths)
        raise TimeoutError(
            f"[E2E SANDBOX] Server tidak responsif dalam {timeout_sec} detik pada port {port}. "
            f"Log terakhir: {_read_server_log(paths)}"
        )

    print(f"[E2E SANDBOX] Server aktif pada http://127.0.0.1:{port} (PID: {proc.pid})")
    return proc, paths.db_path


def stop_sandbox_server(proc, paths=DEFAULT_PATHS):
    """Menghentikan subprocess server dan membersihkan database sementara."""
    if proc:
        print(f"[E2E SANDBOX] Menghentikan server PID {proc.pid}...")
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()

    time.sleep(0.5)

    for suffix in ("", "-wal", "-shm"):
        db_file = paths.db_path + suffix
        if not os.path.exists(db_file):
            continue
        for _ in range(5):
            try:
                os.remove(db_file)
                print(f"[E2E SANDBOX] Berkas sementara {db_file} berhasil dihapus.")
                break
            except OSError:
                time.sleep(0.5)

    for sandbox_only in (paths.notes_dir, paths.project_root, paths.backup_dir, paths.instance_dir, paths.temp_dir):
        shutil.rmtree(sandbox_only, ignore_errors=True)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--standalone":
        port = int(sys.argv[2]) if len(sys.argv) > 2 else 7016
        proc, db_p = start_sandbox_server(port, DEFAULT_PATHS)
        try:
            print("Tekan Ctrl+C untuk menghentikan server sandbox...")
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            stop_sandbox_server(proc, DEFAULT_PATHS)
