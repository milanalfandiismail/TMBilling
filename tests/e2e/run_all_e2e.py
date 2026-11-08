"""Master E2E Test Orchestrator TMBilling.

Alur per suite:
    prepare_sandbox_database(paths) -> start_sandbox_server(port, paths) ->
    node tests/e2e/run_all_e2e.js --suite <id> --json results/<id>.json ->
    stop_sandbox_server(proc, paths)

Setiap suite berjalan di proses Python baru karena `app` membaca environment
saat import. `--jobs 0` memakai semua CPU; `--jobs 1` untuk debug serial.

Semua angka hasil diambil dari laporan JSON yang ditulis runner Node; tidak ada
total yang ditulis tangan di skrip ini.

Exit code: 0 semua check lulus, 1 ada check gagal atau berkas produksi
berubah, 2 lingkungan/setup bermasalah (browser, sandbox, laporan hilang).
"""

import argparse
import contextlib
import hashlib
import json
import multiprocessing
import os
import socket
import sqlite3
import subprocess
import sys
import traceback

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

INSTANCE_DIR = os.path.join(PROJECT_ROOT, "instance")
PROD_DB_PATH = os.path.join(INSTANCE_DIR, "warnet.db")
E2E_DIR = os.path.dirname(os.path.abspath(__file__))
RESULTS_DIR = os.path.join(E2E_DIR, "results")
RUNNER_JS = os.path.join(E2E_DIR, "run_all_e2e.js")


def resolve_jobs(requested, suite_count):
    if suite_count <= 0:
        raise ValueError("tidak ada suite untuk dijalankan")
    if requested < 0:
        raise ValueError("--jobs tidak boleh negatif")
    if requested == 0:
        return min(suite_count, os.cpu_count() or 4)
    return min(requested, suite_count)


def free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def _sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def prod_db_snapshot():
    """Snapshot read-only database produksi: sha256 + jumlah baris per tabel."""
    if not os.path.exists(PROD_DB_PATH):
        return None
    uri = "file:{}?mode=ro".format(PROD_DB_PATH.replace(os.sep, "/"))
    conn = sqlite3.connect(uri, uri=True)
    try:
        tables = [
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' "
                "AND name NOT LIKE 'sqlite_%' ORDER BY name"
            )
        ]
        counts = {t: conn.execute('SELECT COUNT(*) FROM "{}"'.format(t)).fetchone()[0] for t in tables}
    finally:
        conn.close()
    return {"sha256": _sha256(PROD_DB_PATH), "tables": counts}


GUARD_LABELS = {
    "db": "instance/warnet.db",
    "backups": "backups/",
    "notes": "instance/notes/",
    "env": ".env",
    "initial_admin": "initial_admin.txt",
}


def tree_snapshot(path):
    """Snapshot read-only berkas tunggal atau isi direktori (sha256 + ukuran)."""
    if not os.path.exists(path):
        return None
    if os.path.isfile(path):
        return {"sha256": _sha256(path), "size": os.path.getsize(path)}
    entries = {}
    for root, dirs, files in os.walk(path):
        dirs.sort()
        for name in sorted(files):
            full = os.path.join(root, name)
            rel = os.path.relpath(full, path).replace(os.sep, "/")
            entries[rel] = {"sha256": _sha256(full), "size": os.path.getsize(full)}
    return entries


def prod_snapshot():
    return {
        "db": prod_db_snapshot(),
        "backups": tree_snapshot(os.path.join(PROJECT_ROOT, "backups")),
        "notes": tree_snapshot(os.path.join(INSTANCE_DIR, "notes")),
        "env": tree_snapshot(os.path.join(PROJECT_ROOT, ".env")),
        "initial_admin": tree_snapshot(os.path.join(PROJECT_ROOT, "initial_admin.txt")),
    }


def _diff_db(label, before, after):
    diffs = []
    if before["sha256"] != after["sha256"]:
        diffs.append("{}: sha256 berubah ({} -> {})".format(label, before["sha256"][:12], after["sha256"][:12]))
    for table in sorted(set(before["tables"]) | set(after["tables"])):
        old = before["tables"].get(table)
        new = after["tables"].get(table)
        if old != new:
            diffs.append("{} tabel {}: {} -> {} baris".format(label, table, old, new))
    return diffs


def _diff_tree(label, before, after):
    if isinstance(before, dict) and isinstance(after, dict) \
            and isinstance(before.get("sha256"), str) and isinstance(after.get("sha256"), str):
        if before["sha256"] != after["sha256"]:
            return ["{}: sha256 berubah ({} -> {})".format(label, before["sha256"][:12], after["sha256"][:12])]
        return []
    diffs = []
    for name in sorted(set(before) | set(after)):
        old = before.get(name)
        new = after.get(name)
        if old is None:
            diffs.append("{}/{}: baru selama pengujian".format(label, name))
        elif new is None:
            diffs.append("{}/{}: hilang selama pengujian".format(label, name))
        elif old["sha256"] != new["sha256"]:
            diffs.append("{}/{}: sha256 berubah ({} -> {})".format(
                label, name, old["sha256"][:12], new["sha256"][:12]))
    return diffs


def snapshot_diff(before, after):
    """Daftar perubahan antara dua snapshot; kosong berarti berkas produksi tidak tersentuh."""
    if before is None and after is None:
        return []
    if before is None or after is None:
        return ["snapshot produksi tidak lengkap"]
    diffs = []
    for key in sorted(set(before) | set(after)):
        label = GUARD_LABELS.get(key, key)
        old = before.get(key)
        new = after.get(key)
        if old is None and new is None:
            continue
        if old is None:
            diffs.append("{}: muncul selama pengujian".format(label))
            continue
        if new is None:
            diffs.append("{}: hilang selama pengujian".format(label))
            continue
        if key == "db":
            diffs.extend(_diff_db(label, old, new))
        else:
            diffs.extend(_diff_tree(label, old, new))
    return diffs


def print_suite_ids():
    """Cetak registry suite apa adanya dari CLI Node (satu sumber daftar)."""
    completed = subprocess.run(["node", RUNNER_JS, "--list"], cwd=PROJECT_ROOT)
    return completed.returncode


def node_suite_ids():
    completed = subprocess.run(
        ["node", RUNNER_JS, "--list"], cwd=PROJECT_ROOT, capture_output=True, text=True
    )
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr.strip() or "gagal membaca daftar suite")
    return [line.strip() for line in completed.stdout.splitlines() if line.strip()]


def _run_suite_worker(payload):
    """Worker process: satu suite, satu DB, satu port, satu log."""
    from tests.e2e.e2e_sandbox_server import (
        sandbox_paths,
        start_sandbox_server,
        stop_sandbox_server,
    )

    suite_id = payload[0]
    paths = sandbox_paths(suite_id)
    os.makedirs(RESULTS_DIR, exist_ok=True)
    report_path = os.path.join(RESULTS_DIR, "{}.json".format(suite_id))
    log_path = os.path.join(RESULTS_DIR, "{}.log".format(suite_id))
    if os.path.exists(report_path):
        os.remove(report_path)

    proc = None
    exit_code = 2
    error = None
    try:
        with open(log_path, "w", encoding="utf-8", errors="replace") as log, \
                contextlib.redirect_stdout(log), contextlib.redirect_stderr(log):
            try:
                for attempt in range(3):
                    port = free_port()
                    try:
                        proc, _ = start_sandbox_server(port=port, paths=paths, timeout_sec=60)
                        break
                    except RuntimeError as exc:
                        if "Port" not in str(exc) or attempt == 2:
                            raise
                        print("[E2E] Port {} dipakai, mencoba port lain...".format(port))
                if proc is None:
                    raise RuntimeError("sandbox gagal start setelah 3 percobaan port")

                env = os.environ.copy()
                env["E2E_BASE_URL"] = "http://127.0.0.1:{}".format(port)
                env["E2E_SANDBOX_DB"] = paths.db_path
                env["TM_NOTES_DIR"] = paths.notes_dir
                env["BACKUP_DIR"] = paths.backup_dir
                completed = subprocess.run(
                    ["node", RUNNER_JS, "--suite", suite_id, "--json", report_path],
                    cwd=PROJECT_ROOT,
                    env=env,
                    stdout=log,
                    stderr=subprocess.STDOUT,
                )
                exit_code = completed.returncode
            except Exception as exc:
                error = str(exc)
                traceback.print_exc(file=log)
            finally:
                if proc:
                    stop_sandbox_server(proc, paths)
    except Exception as exc:
        error = str(exc)
        exit_code = 2

    report = None
    if os.path.exists(report_path):
        try:
            with open(report_path, encoding="utf-8") as fh:
                report = json.load(fh)
        except (OSError, ValueError) as exc:
            error = "laporan tidak bisa dibaca: {}".format(exc)
            exit_code = 2
    else:
        error = error or "laporan tidak ditulis"
        exit_code = 2

    return {"suite": suite_id, "exit_code": exit_code, "report": report, "error": error}


def main(argv=None):
    parser = argparse.ArgumentParser(description="Orkestrator E2E TMBilling (sandbox + guard database produksi).")
    parser.add_argument("--suite", help="id suite; pisahkan dengan koma untuk beberapa suite")
    parser.add_argument("--list", action="store_true", help="cetak daftar id suite lalu keluar")
    parser.add_argument("--no-guard", action="store_true", help="lewati pemeriksaan berkas produksi")
    parser.add_argument(
        "--jobs",
        type=int,
        default=0,
        help="jumlah worker paralel; 0 = semua CPU (default), 1 = serial",
    )
    parser.add_argument(
        "--self-test",
        action="store_true",
        help="jalankan suite _selftest dan pastikan kegagalannya diteruskan ke exit code",
    )
    args = parser.parse_args(argv)

    if args.list:
        return print_suite_ids()

    if args.self_test and args.suite:
        parser.error("--self-test dan --suite tidak bisa dipakai bersamaan")

    if args.self_test:
        suite_ids = ["_selftest"]
    elif args.suite:
        suite_ids = [s.strip() for s in args.suite.split(",") if s.strip()]
    else:
        suite_ids = [s for s in node_suite_ids() if not s.startswith("_")]

    try:
        jobs = resolve_jobs(args.jobs, len(suite_ids))
    except ValueError as exc:
        print("GAGAL: {}".format(exc))
        return 2

    print("=" * 65)
    print("TMBILLING E2E TEST ORCHESTRATOR")
    print("=" * 65)
    print("Suite: {}".format(", ".join(suite_ids)))
    print("Worker: {}".format(jobs))

    before = None
    if not args.no_guard:
        before = prod_snapshot()
        db_before = before["db"]
        if db_before:
            print("Guard database produksi: sha256 {} ({} tabel)".format(
                db_before["sha256"][:12], len(db_before["tables"])))
        else:
            print("Guard database produksi: instance/warnet.db tidak ada, pemeriksaan dilewati.")
        print("Guard berkas produksi: backups/, instance/notes/, .env, initial_admin.txt")

    total = passed = failed = 0
    exit_code = 0

    def consume(result):
        nonlocal total, passed, failed, exit_code
        suite_id = result["suite"]
        report = result["report"]
        runner_code = result["exit_code"]
        if report is None:
            print("GAGAL: suite {} tidak menghasilkan laporan (exit code {}).".format(suite_id, runner_code))
            if result.get("error"):
                print("  {}".format(result["error"]))
            log_path = os.path.join(RESULTS_DIR, "{}.log".format(suite_id))
            if os.path.exists(log_path):
                with open(log_path, encoding="utf-8", errors="replace") as fh:
                    tail = fh.read()[-2000:].strip()
                if tail:
                    print("  --- log terakhir {} ---".format(suite_id))
                    print(tail)
            exit_code = 2
            return

        total += report.get("total", 0)
        passed += report.get("passed", 0)
        failed += report.get("failed", 0)
        print(
            "Hasil {}: {} check, {} lulus, {} gagal (exit code {})".format(
                suite_id, report.get("total", 0), report.get("passed", 0), report.get("failed", 0), runner_code
            )
        )
        if result.get("error"):
            print("  error: {}".format(result["error"]))
        if runner_code == 2:
            exit_code = 2
        elif runner_code != 0 and exit_code == 0:
            exit_code = 1

    # Selalu proses terpisah per suite: `app.config` membaca environment saat
    # import, jadi menjalankan beberapa suite di proses yang sama memakai DB suite pertama.
    context = multiprocessing.get_context("spawn")
    try:
        with context.Pool(processes=jobs, maxtasksperchild=1) as pool:
            tasks = [(suite_id,) for suite_id in suite_ids]
            for result in pool.imap_unordered(_run_suite_worker, tasks, chunksize=1):
                print("\n" + "-" * 65)
                print("Selesai: {}".format(result["suite"]))
                print("-" * 65)
                consume(result)
    except KeyboardInterrupt:
        print("\nDIBATALKAN: menghentikan worker...")
        return 2

    if failed > 0 and exit_code == 0:
        exit_code = 1

    print("\n" + "=" * 65)
    print("TOTAL: {} check, {} lulus, {} gagal".format(total, passed, failed))
    print("=" * 65)

    if not args.no_guard:
        diffs = snapshot_diff(before, prod_snapshot())
        if diffs:
            print("GAGAL GUARD: berkas produksi berubah selama pengujian:")
            for diff in diffs:
                print("  - {}".format(diff))
            return 1
        print("Guard produksi: instance/warnet.db, backups/, instance/notes/, .env, initial_admin.txt tidak berubah.")

    if args.self_test:
        # Self-test dianggap berhasil bila kegagalan check benar-benar terlihat.
        if failed > 0 and exit_code == 1:
            print("SELF-TEST OK: kegagalan check diteruskan ke exit code.")
            return 0
        print("SELF-TEST GAGAL: runner menelan kegagalan (exit code {}).".format(exit_code))
        return 1

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
