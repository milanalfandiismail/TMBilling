import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1] / "app" / "static" / "js"
INTERP = re.compile(r"\$\{([^{}]*)\}")


def _offenders():
    out = []
    for path in ROOT.rglob("*.js"):
        for no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if "innerHTML" not in line or "${" not in line:
                continue
            if "// xss-reviewed" in line:
                continue
            for expr in INTERP.findall(line):
                if "escapeHtml(" in expr or ".esc(" in expr:
                    continue
                out.append(f"{path.relative_to(ROOT.parents[2])}:{no}: {expr.strip()[:60]}")
    return out


def test_innerhtml_interpolation_is_escaped():
    offenders = _offenders()
    assert offenders == [], "innerHTML dengan data tak di-escape:\n" + "\n".join(offenders)


def test_xss_marker_has_reason():
    bad = []
    for path in ROOT.rglob("*.js"):
        for no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if "xss-reviewed" not in line:
                continue
            reason = line.split("xss-reviewed:", 1)
            if len(reason) != 2 or len(reason[1].strip()) < 12:
                bad.append(f"{path.relative_to(ROOT.parents[2])}:{no}")
    assert bad == [], "marker tanpa alasan jelas:\n" + "\n".join(bad)
