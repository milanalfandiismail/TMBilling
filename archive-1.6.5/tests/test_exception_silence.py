import ast
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1] / "app"


def _swallows(handler):
    if handler.type is None:
        name = "ANY"
    elif isinstance(handler.type, ast.Name):
        name = handler.type.id
    else:
        return False
    if name not in ("Exception", "BaseException", "ANY"):
        return False
    if any(isinstance(n, ast.Call) for n in ast.walk(handler)):
        return False
    for node in handler.body:
        if isinstance(node, ast.Pass):
            continue
        # return <nilai> berarti kegagalan dilaporkan ke pemanggil, bukan ditelan.
        if isinstance(node, ast.Return) and node.value is None:
            continue
        return False
    return True


def test_no_silent_exception_swallow():
    offenders = []
    for path in ROOT.rglob("*.py"):
        text = path.read_text(encoding="utf-8-sig")
        lines = text.splitlines()
        for node in ast.walk(ast.parse(text)):
            if not isinstance(node, ast.ExceptHandler):
                continue
            if not _swallows(node):
                continue
            if "noqa: silent" in lines[node.lineno - 1]:
                continue
            offenders.append(f"{path.relative_to(ROOT.parent)}:{node.lineno}")
    assert offenders == [], "except senyap tanpa alasan:\n" + "\n".join(offenders)


def test_silent_marker_has_reason():
    bad = []
    for path in ROOT.rglob("*.py"):
        for no, line in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), 1):
            if "noqa: silent" not in line:
                continue
            reason = line.split("noqa: silent", 1)[1].lstrip()
            if not reason.startswith("- ") or len(reason) < 12:
                bad.append(f"{path.relative_to(ROOT.parent)}:{no}")
    assert bad == [], "marker tanpa alasan jelas:\n" + "\n".join(bad)
