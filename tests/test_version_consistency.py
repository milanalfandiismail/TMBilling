import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
PYTHON_FROZEN = "1.6.5"


def _rust_version():
    """Versi rilis server sejak 2.0.0 dibaca dari crate Rust (jalur Python dibekukan)."""
    source = (ROOT / "app-rust" / "Cargo.toml").read_text(encoding="utf-8-sig")
    match = re.search(r'^version\s*=\s*"([^"]+)"', source, re.MULTILINE)
    assert match, "version tidak ditemukan di app-rust/Cargo.toml"
    return match.group(1)


def _python_version():
    source = (ROOT / "app" / "config.py").read_text(encoding="utf-8-sig")
    match = re.search(r'^\s*VERSION\s*=\s*["\']([^"\']+)["\']', source, re.MULTILINE)
    assert match, "VERSION tidak ditemukan di app/config.py"
    return match.group(1)


def test_core_version_sources_match():
    version = _rust_version()
    assert json.loads((ROOT / "package.json").read_text(encoding="utf-8-sig"))["version"] == version
    tauri = ROOT / "WarnetAgent" / "TMBillingTauri" / "package.json"
    assert json.loads(tauri.read_text(encoding="utf-8-sig"))["version"] == version
    konf = ROOT / "WarnetAgent" / "TMBillingTauri" / "src-tauri" / "tauri.conf.json"
    assert json.loads(konf.read_text(encoding="utf-8-sig"))["package"]["version"] == version


def test_python_reference_frozen():
    assert _python_version() == PYTHON_FROZEN


def test_readme_badge_matches_version():
    badge = "Version-v{}-blue".format(_rust_version().replace("-", "--"))
    assert badge in (ROOT / "README.md").read_text(encoding="utf-8-sig")


def test_blueprint_count_matches_dokumentasi():
    documented = re.search(r"pendaftaran (\d+) Blueprint", (ROOT / "AGENTS.md").read_text(encoding="utf-8-sig"))
    assert documented, "AGENTS.md tidak menyebut jumlah blueprint"
    source = (ROOT / "app" / "__init__.py").read_text(encoding="utf-8-sig")
    actual = len(re.findall(r"^\s*app\.register_blueprint\(", source, re.MULTILINE))
    assert actual == int(documented.group(1))
