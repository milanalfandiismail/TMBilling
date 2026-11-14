import json
import pathlib

CONF = json.loads(pathlib.Path("WarnetAgent/TMBillingTauri/src-tauri/tauri.conf.json").read_text(encoding="utf-8"))


def test_allowlist_tidak_membuka_semua_api():
    assert CONF["tauri"]["allowlist"].get("all") is not True


def test_csp_diset():
    csp = CONF["tauri"]["security"]["csp"]
    assert isinstance(csp, str)
    assert "default-src 'self'" in csp
