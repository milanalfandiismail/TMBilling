import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1] / "app" / "static" / "js"
INTERP = re.compile(r"\$\{([^{}]*)\}")


def _blocks(lines, start):
    """Baris innerHTML plus lanjutan template literal sampai backtick seimbang."""
    block = [lines[start]]
    if block[0].count("`") % 2 == 0:
        return block
    ticks = block[0].count("`")
    for line in lines[start + 1:start + 80]:
        block.append(line)
        ticks += line.count("`")
        if ticks % 2 == 0:
            break
    return block


def _offenders(root=ROOT):
    out = []
    for path in root.rglob("*.js"):
        lines = path.read_text(encoding="utf-8").splitlines()
        for i, line in enumerate(lines):
            if "innerHTML" not in line:
                continue
            if "// xss-reviewed" in line or "// xss-reviewed" in lines[i - 1]:
                continue
            for offset, text in enumerate(_blocks(lines, i)):
                for expr in INTERP.findall(text):
                    if "escapeHtml(" in expr or ".esc(" in expr:
                        continue
                    out.append(f"{path.relative_to(root.parents[2])}:{i + offset + 1}: {expr.strip()[:60]}")
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
