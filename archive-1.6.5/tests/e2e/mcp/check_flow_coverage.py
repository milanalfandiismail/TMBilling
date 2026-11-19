"""Gate cakupan: setiap handler UI harus punya kasus E2E atau alasan exempt."""
import argparse, json, sys
from flow_inventory import check, inventory


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".")
    ap.add_argument("--map", default="tests/e2e/mcp/coverage_map.json")
    ap.add_argument("--write-map", action="store_true")
    a = ap.parse_args()
    if a.write_map:
        inv = inventory(a.root)
        mods = sorted({h.split(".")[0] for h in inv["handlers"]})
        data = {"cases": {m + ".*": "UNMAPPED" for m in mods}, "exempt": {}}
        open(a.map, "w", encoding="utf-8").write(json.dumps(data, indent=2) + "\n")
        print(f"handler={len(inv['handlers'])} tabs={len(inv['tabs'])} subtabs={len(inv['settings_subtabs'])} modul={len(mods)}")
        print("modul:", " ".join(mods))
        return 1
    res = check(a.root, a.map)
    print(f"handler={res['handlers']} unclassified={len(res['unclassified'])} missing_cases={len(res['missing_cases'])} missing_evidence={len(res['missing_evidence'])}")
    for h in res["unclassified"]:
        print("  UNCLASSIFIED", h)
    for h, c in res["missing_cases"]:
        print("  MISSING_CASE", c, "dari", h)
    for h in res["missing_evidence"]:
        print("  MISSING_EVIDENCE", h)
    ok = not res["unclassified"] and not res["missing_cases"] and not res["missing_evidence"]
    print("GATE LULUS" if ok else "GATE GAGAL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
