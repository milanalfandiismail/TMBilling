import ast
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]


def _version():
    source = (ROOT / "app" / "config.py").read_text(encoding="utf-8-sig")
    match = re.search(r'^\s*VERSION\s*=\s*["\']([^"\']+)["\']', source, re.MULTILINE)
    assert match, "VERSION tidak ditemukan di app/config.py"
    return match.group(1)


def test_core_version_sources_match():
    version = _version()
    assert json.loads((ROOT / "package.json").read_text(encoding="utf-8-sig"))["version"] == version
    tauri = ROOT / "WarnetAgent" / "TMBillingTauri" / "package.json"
    assert json.loads(tauri.read_text(encoding="utf-8-sig"))["version"] == version


def test_readme_badge_matches_version():
    badge = "Version-v{}-blue".format(_version().replace("-", "--"))
    assert badge in (ROOT / "README.md").read_text(encoding="utf-8-sig")


def test_blueprint_count_matches_dokumentasi():
    documented = re.search(r"pendaftaran (\d+) Blueprint", (ROOT / "AGENTS.md").read_text(encoding="utf-8-sig"))
    assert documented, "AGENTS.md tidak menyebut jumlah blueprint"
    source = (ROOT / "app" / "__init__.py").read_text(encoding="utf-8-sig")
    actual = len(re.findall(r"^\s*app\.register_blueprint\(", source, re.MULTILINE))
    assert actual == int(documented.group(1))
