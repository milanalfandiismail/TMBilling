import ast
import pathlib

SERVICES = pathlib.Path(__file__).resolve().parents[1] / "app" / "services"


def _is_db_commit(node):
    return (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "commit"
        and isinstance(node.func.value, ast.Attribute)
        and node.func.value.attr == "session"
        and isinstance(node.func.value.value, ast.Name)
        and node.func.value.value.id == "db"
    )


def _has_lock(fn):
    if any(
        isinstance(d, ast.Name) and d.id == "with_write_lock"
        for d in fn.decorator_list
    ):
        return True
    for node in ast.walk(fn):
        if isinstance(node, ast.With):
            for item in node.items:
                if isinstance(item.context_expr, ast.Name) and item.context_expr.id == "WRITE_LOCK":
                    return True
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "acquire"
            and isinstance(node.func.value, ast.Name)
            and node.func.value.id == "WRITE_LOCK"
        ):
            return True
    return False


def _has_reason(fn, lines):
    end = fn.end_lineno or fn.lineno
    return any("# lock:" in lines[i] for i in range(fn.lineno - 1, end))


def _scan():
    found = []
    for path in SERVICES.rglob("*.py"):
        # utf-8-sig: minimal satu berkas repo menyimpan BOM
        text = path.read_text(encoding="utf-8-sig")
        lines = text.splitlines()
        found.append((path, text, lines, ast.parse(text)))
    return found


def test_every_service_commit_is_lock_guarded():
    offenders = []
    for path, _, lines, tree in _scan():
        for fn in ast.walk(tree):
            if not isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            if not any(_is_db_commit(n) for n in ast.walk(fn)):
                continue
            if fn.name.endswith("_locked"):
                continue  # pemanggil memegang lock; dijaga test kedua
            if _has_lock(fn) or _has_reason(fn, lines):
                continue
            offenders.append(f"{path.relative_to(SERVICES.parents[1])}:{fn.lineno}:{fn.name}")
    assert offenders == [], "commit tanpa WRITE_LOCK:\n" + "\n".join(offenders)


def test_locked_helper_is_called_from_lock_holder():
    orphans = []
    for path, text, _, tree in _scan():
        scopes = {
            fn.name: fn
            for fn in ast.walk(tree)
            if isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef))
        }
        for name, fn in scopes.items():
            if not name.endswith("_locked"):
                continue
            callers = [
                other
                for other in scopes.values()
                if other is not fn
                and _has_lock(other)
                and any(
                    isinstance(n, ast.Call)
                    and isinstance(n.func, ast.Attribute)
                    and n.func.attr == name
                    for n in ast.walk(other)
                )
            ]
            if not callers:
                orphans.append(f"{path.relative_to(SERVICES.parents[1])}:{fn.lineno}:{name}")
    # shortcut: hanya pemanggil di berkas yang sama, cukup untuk pola repo saat ini
    assert orphans == [], "helper _locked tanpa pemanggil ber-lock:\n" + "\n".join(orphans)
