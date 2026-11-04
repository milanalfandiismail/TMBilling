"""Master E2E Test Orchestrator TMBilling.

Alur per suite:
    prepare_sandbox_database() -> start_sandbox_server() ->
    node tests/e2e/run_all_e2e.js --suite <id> --json results/<id>.json ->
    stop_sandbox_server()

Semua angka hasil diambil dari laporan JSON yang ditulis runner Node; tidak ada
total yang ditulis tangan di skrip ini.

Exit code: 0 semua check lulus, 1 ada check gagal atau database produksi
berubah, 2 lingkungan/setup bermasalah (port terpakai, sandbox gagal start).
"""

import argparse
import hashlib
import json
import os
import sqlite3
import subprocess
import sys
import urllib.request

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
SANDBOX_PORT = 7016


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


def snapshot_diff(before, after):
    """Daftar perubahan antara dua snapshot; kosong berarti database tidak tersentuh."""
    if before is None and after is None:
        return []
    if (before is None) != (after is None):
        return ["instance/warnet.db muncul atau hilang selama pengujian"]
    diffs = []
    if before["sha256"] != after["sha256"]:
        diffs.append("sha256 berubah ({} -> {})".format(before["sha256"][:12], after["sha256"][:12]))
    for table in sorted(set(before["tables"]) | set(after["tables"])):
        old = before["tables"].get(table)
        new = after["tables"].get(table)
        if old != new:
            diffs.append("tabel {}: {} -> {} baris".format(table, old, new))
    return diffs


def sandbox_port_busy(port=SANDBOX_PORT):
    try:
        with urllib.request.urlopen("http://127.0.0.1:{}/kasir/login".format(port), timeout=1.5) as resp:
            return resp.status == 200
    except Exception:
        return False


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


def run_suite(suite_id):
    """Jalankan satu suite pada sandbox yang baru di-seed.

    Mengembalikan (exit_code_runner, laporan_json_atau_None).
    """
    from tests.e2e.e2e_sandbox_server import start_sandbox_server, stop_sandbox_server

    os.makedirs(RESULTS_DIR, exist_ok=True)
    report_path = os.path.join(RESULTS_DIR, "{}.json".format(suite_id))
    # Laporan run sebelumnya tidak boleh dianggap hasil run ini.
    if os.path.exists(report_path):
        os.remove(report_path)

    proc = None
    db_path = None
    try:
        proc, db_path = start_sandbox_server(port=SANDBOX_PORT)
        completed = subprocess.run(
            ["node", RUNNER_JS, "--suite", suite_id, "--json", report_path],
            cwd=PROJECT_ROOT,
        )
        exit_code = completed.returncode
    finally:
        if proc:
            stop_sandbox_server(proc, db_path)

    report = None
    if os.path.exists(report_path):
        with open(report_path, encoding="utf-8") as fh:
            report = json.load(fh)
    return exit_code, report


def main(argv=None):
    parser = argparse.ArgumentParser(description="Orkestrator E2E TMBilling (sandbox + guard database produksi).")
    parser.add_argument("--suite", help="id suite; pisahkan dengan koma untuk beberapa suite")
    parser.add_argument("--list", action="store_true", help="cetak daftar id suite lalu keluar")
    parser.add_argument("--no-guard", action="store_true", help="lewati pemeriksaan database produksi")
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

    print("=" * 65)
    print("TMBILLING E2E TEST ORCHESTRATOR")
    print("=" * 65)
    print("Suite: {}".format(", ".join(suite_ids)))

    if sandbox_port_busy():
        print("GAGAL: port {} sudah dipakai (sandbox standalone masih hidup?).".format(SANDBOX_PORT))
        print("Hentikan dulu proses `npm run test:e2e:sandbox` sebelum menjalankan orkestrator.")
        return 2

    before = None
    if not args.no_guard:
        before = prod_db_snapshot()
        if before:
            print("Guard database produksi: sha256 {} ({} tabel)".format(before["sha256"][:12], len(before["tables"])))
        else:
            print("Guard database produksi: instance/warnet.db tidak ada, pemeriksaan dilewati.")

    total = passed = failed = 0
    exit_code = 0
    for suite_id in suite_ids:
        print("\n" + "-" * 65)
        print("Suite: {}".format(suite_id))
        print("-" * 65)
        try:
            runner_code, report = run_suite(suite_id)
        except Exception as exc:
            print("GAGAL: sandbox untuk suite {} tidak bisa dijalankan: {}".format(suite_id, exc))
            return 2

        if report is None:
            print("GAGAL: runner tidak menulis laporan untuk suite {} (exit code {}).".format(suite_id, runner_code))
            exit_code = 2
            break

        total += report.get("total", 0)
        passed += report.get("passed", 0)
        failed += report.get("failed", 0)
        print(
            "Hasil {}: {} check, {} lulus, {} gagal (exit code {})".format(
                suite_id, report.get("total", 0), report.get("passed", 0), report.get("failed", 0), runner_code
            )
        )
        if runner_code != 0 and exit_code == 0:
            exit_code = 1

    if failed > 0 and exit_code == 0:
        exit_code = 1

    print("\n" + "=" * 65)
    print("TOTAL: {} check, {} lulus, {} gagal".format(total, passed, failed))
    print("=" * 65)

    if not args.no_guard:
        diffs = snapshot_diff(before, prod_db_snapshot())
        if diffs:
            print("GAGAL GUARD: instance/warnet.db berubah selama pengujian:")
            for diff in diffs:
                print("  - {}".format(diff))
            return 1
        print("Guard database produksi: instance/warnet.db tidak berubah.")

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
