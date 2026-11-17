"""Inventaris tab & handler UI untuk gate cakupan E2E."""
import json, pathlib, re

TABS_RE = re.compile(r'id="tab-([a-z_]+)"')
SUB_RE = re.compile(r'id="subtab-([a-z_]+)"')
HANDLER_RE = re.compile(r'onclick="([A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*)\(')
PORTALS = ["/", "/tv", "/tv/static", "/livepc", "/member/login", "/games", "/paket", "/spesifikasi"]


def inventory(root="."):
    root = pathlib.Path(root)
    tabs, seen = [], set()
    for f in (root / "app/templates/kasir").rglob("*.html"):
        for t in TABS_RE.findall(f.read_text(encoding="utf-8", errors="replace")):
            if t not in seen:
                seen.add(t); tabs.append(t)
    subs, seen = [], set()
    for f in (root / "app/templates/kasir").rglob("*.html"):
        for s in SUB_RE.findall(f.read_text(encoding="utf-8", errors="replace")):
            if s not in seen:
                seen.add(s); subs.append(s)
    handlers = set()
    for base in (root / "app/templates/kasir", root / "app/static/js/kasir"):
        for f in base.rglob("*"):
            if f.suffix not in (".html", ".js"):
                continue
            try:
                handlers.update(m for m in HANDLER_RE.findall(f.read_text(encoding="utf-8", errors="replace"))
                                 if m.split(".")[0] not in ("document", "window", "event", "this"))
            except OSError:
                pass
    return {"tabs": tabs, "settings_subtabs": subs, "portals": PORTALS, "handlers": sorted(handlers)}


def _match(mapping, name):
    if name in mapping:
        return mapping[name]
    mod = name.split(".")[0] + ".*"
    return mapping.get(mod)


def check(root, map_path):
    inv = inventory(root)
    data = json.loads(pathlib.Path(map_path).read_text(encoding="utf-8")) if pathlib.Path(map_path).exists() else {}
    cases, exempt = data.get("cases", {}), data.get("exempt", {})
    unclassified, missing = [], []
    docs = pathlib.Path(root, "tests/e2e/mcp/cases")
    text = "\n".join(p.read_text(encoding="utf-8") for p in docs.glob("*.md")) if docs.is_dir() else ""
    for h in inv["handlers"]:
        cid = _match(cases, h)
        if not cid:
            if h not in exempt and not _match(exempt, h):
                unclassified.append(h)
            continue
        m = re.match(r"^(K|P)-[A-Z]+-\d+", cid)
        if m and m.group(0) not in text:
            missing.append((h, m.group(0)))
    return {"unclassified": sorted(unclassified), "missing_cases": sorted(set(missing)),
            "handlers": len(inv["handlers"]), "tabs": inv["tabs"], "settings_subtabs": inv["settings_subtabs"]}
