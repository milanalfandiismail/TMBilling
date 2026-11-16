"""Gerbang paritas endpoint: Python (Flask url_map) vs Rust (app.rs router).

Dipakai Task 15. Jalankan dari root repo:
    .venv\\Scripts\\python.exe scripts\\rust_parity.py
"""

import os
import re
import sys
import tempfile


def rust_routes(path="app-rust/src/app.rs"):
    sumber = open(path, encoding="utf-8").read()
    hasil = set()
    for m in re.finditer(r"\.route\(", sumber):
        i = m.end()
        kedalaman = 1
        while i < len(sumber) and kedalaman:
            if sumber[i] == "(":
                kedalaman += 1
            elif sumber[i] == ")":
                kedalaman -= 1
            i += 1
        potongan = sumber[m.end(): i - 1]
        jalur = re.match(r'\s*"([^"]+)"', potongan)
        if not jalur:
            continue
        path_ = jalur.group(1)
        sisa = potongan[jalur.end():]
        for verb in ("get", "post", "put", "delete", "patch"):
            if re.search(r"\b%s\(" % verb, sisa):
                hasil.add((verb.upper(), path_))
    return hasil


def python_routes():
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    os.environ.setdefault("TM_NOTES_DIR", tempfile.mkdtemp())
    db = os.path.join(tempfile.mkdtemp(), "parity.db")
    os.environ["DATABASE_URL"] = "sqlite:///" + db.replace("\\", "/")
    from app import create_app
    from app.config import Config

    Config.SQLALCHEMY_DATABASE_URI = "sqlite:///" + db.replace("\\", "/")
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": Config.SQLALCHEMY_DATABASE_URI})
    hasil = set()
    for rule in app.url_map.iter_rules():
        if rule.endpoint == "static" or rule.rule.startswith("/static"):
            continue
        jalur = re.sub(r"<(?:[a-z]+:)?([a-z_]+)>", r"{\1}", rule.rule)
        for verb in rule.methods - {"HEAD", "OPTIONS"}:
            hasil.add((verb, jalur))
    return hasil


def normal(p):
    # nama parameter bebas berbeda (<int:id> vs {pc_id}); bandingkan bentuknya saja
    return re.sub(r"[{<][^}<>]+[}>]", "{}", p)


def main():
    py = {(v, normal(p)) for v, p in python_routes()}
    rs = {(v, normal(p)) for v, p in rust_routes()}
    hanya_py = sorted(py - rs)
    hanya_rs = sorted(rs - py)
    print("Python endpoint :", len(py))
    print("Rust endpoint   :", len(rs))
    print("Hanya di Python :", len(hanya_py))
    for item in hanya_py:
        print("  -", item[0], item[1])
    # Ekstra di Rust boleh ada (alias trailing-slash / static / alias lama).
    print("Hanya di Rust   :", len(hanya_rs), "(alias, tidak dihitung gagal)")
    for item in hanya_rs:
        print("  +", item[0], item[1])
    return 0 if not hanya_py else 1


if __name__ == "__main__":
    sys.exit(main())
