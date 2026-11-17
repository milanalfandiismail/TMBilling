"""Sandbox E2E biner Rust 2.0.0 (terisolasi, port 7017).

Root sandbox = cwd server, karena Config Rust menurunkan semua path dari cwd
(tidak ada env override). Menyalakan `--init`, seed deterministik, lalu server.

Pemakaian:
    python tests/e2e/rust/rust_sandbox.py            # nyala, Ctrl+C berhenti
    python tests/e2e/rust/rust_sandbox.py --self-test
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
BINARY = REPO / "app-rust" / "target" / "release" / "tmbilling-server.exe"
DEFAULT_ROOT = REPO / "instance" / "e2e" / "mcp-rust"
CREDS = {"admin": ("admin", "admin123"), "kasir": ("kasir1", "kasir123")}

sys.path.insert(0, str(Path(__file__).resolve().parent))


@dataclass
class Handle:
    proc: subprocess.Popen
    port: int
    root: Path
    url: str
    db_path: Path
    log_path: Path
    creds: dict


def _http(url: str, payload: dict | None = None, timeout: float = 5.0,
          extra: dict | None = None):
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode()
        headers["Content-Type"] = "application/json"
    headers.update(extra or {})
    req = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def health(url: str) -> dict:
    status, body = _http(url + "/api/health")
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return {"status": "invalid", "http": status, "body": body[:200]}


def login_ok(url: str, username: str, password: str) -> bool:
    # CSRF double-submit: cookie dan header harus sama, nilainya bebas.
    token = os.urandom(16).hex()
    status, _ = _http(url + "/api/v1/kasir/auth/login",
                      {"username": username, "password": password},
                      extra={"X-CSRFToken": token, "Cookie": f"csrf_token={token}"})
    return status == 200


def _port_free(port: int) -> bool:
    with socket.socket() as s:
        return s.connect_ex(("127.0.0.1", port)) != 0


def start(port: int = 7017, root: Path | str | None = None,
          binary: Path | str | None = None, seed: bool = True) -> Handle:
    root = Path(root) if root else DEFAULT_ROOT
    binary = Path(binary) if binary else BINARY
    if not binary.exists():
        raise SystemExit(f"[E2E] biner belum dibangun: {binary}\n"
                         "      jalankan: cargo build --release --manifest-path app-rust/Cargo.toml")
    if not _port_free(port):
        raise SystemExit(f"[E2E] port {port} sudah dipakai proses lain")

    root.mkdir(parents=True, exist_ok=True)
    (root / "app" / "data").mkdir(parents=True, exist_ok=True)
    src = REPO / "app" / "data" / "seed_tutorials.json"
    if src.exists():
        shutil.copy2(src, root / "app" / "data" / "seed_tutorials.json")

    env_file = root / ".env"
    if not env_file.exists():
        env_file.write_text(
            f"SECRET_KEY={os.urandom(32).hex()}\nTIMEZONE=Asia/Makassar\n", encoding="utf-8")

    db_path = root / "instance" / "warnet.db"
    log_path = root / "server.log"

    init = subprocess.run([str(binary), "--init"], cwd=root, capture_output=True,
                          text=True, timeout=120)
    if init.returncode != 0:
        raise SystemExit(f"[E2E] --init gagal ({init.returncode}):\n{init.stdout}\n{init.stderr}")

    if seed:
        import seed_rust_sandbox
        counts = seed_rust_sandbox.apply(str(db_path))
        print(f"[E2E] seed: {counts}")

    env = dict(os.environ, PORT=str(port))
    log = open(log_path, "w", encoding="utf-8")
    proc = subprocess.Popen([str(binary)], cwd=root, env=env, stdout=log,
                            stderr=subprocess.STDOUT)

    url = f"http://127.0.0.1:{port}"
    deadline = time.time() + 60
    while time.time() < deadline:
        if proc.poll() is not None:
            log.close()
            tail = log_path.read_text(encoding="utf-8", errors="replace").splitlines()[-20:]
            raise SystemExit("[E2E] server mati saat boot:\n" + "\n".join(tail))
        try:
            status, _ = _http(url + "/api/health", timeout=2)
            if status == 200:
                break
        except OSError:
            pass
        time.sleep(0.5)
    else:
        stop(Handle(proc, port, root, url, db_path, log_path, CREDS), keep=True)
        raise SystemExit("[E2E] health check timeout 60s")

    return Handle(proc, port, root, url, db_path, log_path, CREDS)


def stop(handle: Handle, keep: bool = False) -> None:
    proc = handle.proc
    if proc and proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=8)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=8)
    if not keep:
        for _ in range(20):
            try:
                shutil.rmtree(handle.root)
                break
            except OSError:
                time.sleep(0.25)


def _self_test() -> int:
    root = REPO / "instance" / "e2e" / "mcp-rust-selftest"
    shutil.rmtree(root, ignore_errors=True)
    h = start(root=root)
    try:
        assert health(h.url)["status"] in ("ok", "degraded"), health(h.url)
        assert h.db_path.exists()
        counts = __import__("seed_rust_sandbox").apply(str(h.db_path))
        assert counts["grup"] == 3 and counts["pc"] == 5 and counts["paket"] == 4, counts
        assert counts["user"] == 2 and counts["menu_item"] == 4, counts
        assert login_ok(h.url, "admin", "admin123"), "login admin gagal"
        assert login_ok(h.url, "kasir1", "kasir123"), "login kasir gagal"
    finally:
        stop(h)
    h2 = start(root=root)
    try:
        assert health(h2.url)["status"] in ("ok", "degraded")
    finally:
        stop(h2)
    print("SELF-TEST OK")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=7017)
    ap.add_argument("--root")
    ap.add_argument("--binary")
    ap.add_argument("--keep", action="store_true", help="jangan hapus root saat berhenti")
    ap.add_argument("--no-seed", action="store_true")
    ap.add_argument("--self-test", action="store_true")
    a = ap.parse_args()
    if a.self_test:
        return _self_test()
    h = start(a.port, a.root, a.binary, seed=not a.no_seed)
    print(f"[E2E] {h.url}  root={h.root}\n[E2E] admin/admin123  kasir1/kasir123\n"
          f"[E2E] Ctrl+C untuk berhenti")
    try:
        while True:
            time.sleep(1)
            if h.proc.poll() is not None:
                print("[E2E] server berhenti sendiri, lihat", h.log_path)
                return 1
    except KeyboardInterrupt:
        print("\n[E2E] menghentikan sandbox…")
    finally:
        stop(h, keep=a.keep)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
