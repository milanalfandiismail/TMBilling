"""Gerbang cakupan rute E2E.

Membandingkan rute yang dideklarasikan `app.url_map` (dumped sandbox ke
`routes.json`) dengan endpoint yang benar-benar dipanggil selama suite berjalan
(`requests.log`). Rute yang tidak pernah dipanggil dan tidak ada di
`api_exempt.py` menggagalkan run: rute baru tidak bisa lolos diam-diam.
"""

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from api_exempt import EXEMPT


def _endpoints(path):
    if not os.path.exists(path):
        return set()
    with open(path, encoding="utf-8") as fh:
        return {line.split(" ", 1)[0].strip() for line in fh if line.strip()}


def run(root):
    declared, called = set(), set()
    for suite in sorted(os.listdir(root)):
        suite_dir = os.path.join(root, suite)
        if not os.path.isdir(suite_dir):
            continue
        routes_json = os.path.join(suite_dir, "routes.json")
        if os.path.exists(routes_json):
            with open(routes_json, encoding="utf-8") as fh:
                declared.update(line.split(" ", 1)[0] for line in json.load(fh))
        called.update(_endpoints(os.path.join(suite_dir, "requests.log")))
    return sorted(declared - called - set(EXEMPT))


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=os.path.join("instance", "e2e"))
    args = parser.parse_args(argv)
    missing = run(args.root)
    if missing:
        print(f"GATE GAGAL: {len(missing)} rute tidak pernah dipanggil")
        for endpoint in missing:
            print(f"  - {endpoint}")
        return 1
    print("GATE LULUS: semua rute terpakai atau dikecualikan")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
