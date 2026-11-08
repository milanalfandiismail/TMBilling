"""Pencarian literal all-core: python scripts/allcore_search.py "pola1|pola2" [root ...]"""

import concurrent.futures as cf
import os
import sys
import time

SKIP_DIRS = {".git", ".venv", "node_modules", "__pycache__", "dist", "build", "instance"}
SKIP_EXT = {
    ".exe", ".dll", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".zip", ".db",
    ".db-wal", ".db-shm", ".pyc", ".woff", ".woff2", ".ttf", ".pdf", ".jar",
    ".so", ".dylib", ".bin", ".sqlite", ".lock",
}
MAX_BYTES = 2 * 1024 * 1024


def files_under(root: str):
    for base, dirs, names in os.walk(root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in names:
            if os.path.splitext(name)[1].lower() in SKIP_EXT:
                continue
            path = os.path.join(base, name)
            try:
                if not os.path.islink(path) and os.path.getsize(path) <= MAX_BYTES:
                    yield path
            except OSError:
                pass


def search(args):
    path, patterns = args
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as fh:
            hits = []
            for no, line in enumerate(fh, 1):
                low = line.lower()
                if any(pattern in low for pattern in patterns):
                    hits.append((no, line.strip()[:160]))
            return path, hits
    except OSError:
        return path, []


def main():
    if len(sys.argv) < 2:
        raise SystemExit('usage: allcore_search.py "pola1|pola2" [root ...]')
    patterns = [p.lower() for p in sys.argv[1].split("|") if p]
    roots = sys.argv[2:] or ["."]
    targets = [p for root in roots for p in files_under(root)]
    workers = int(os.environ.get("SEARCH_WORKERS") or os.cpu_count() or 1)
    started = time.perf_counter()
    with cf.ProcessPoolExecutor(max_workers=workers) as pool:
        results = list(pool.map(search, ((p, patterns) for p in targets), chunksize=16))
    elapsed = time.perf_counter() - started
    matched = [(p, h) for p, h in results if h]
    if not os.environ.get("QUIET"):
        for path, hits in matched:
            print("{}  ({} hit)".format(os.path.relpath(path), len(hits)))
            for no, line in hits[:3]:
                print("  {}: {}".format(no, line))
            if len(hits) > 3:
                print("  ...")
    print("\n{} pola, {} file dipindai, {} file cocok, {} core, {:.2f} dtk".format(
        len(patterns), len(targets), len(matched), workers, elapsed))


if __name__ == "__main__":
    main()
