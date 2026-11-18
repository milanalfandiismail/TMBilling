import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from flow_inventory import inventory, check


def test_inventory_contains_known_items():
    inv = inventory(str(pathlib.Path(__file__).parents[3]))
    assert "Blackout.deteksi" in inv["handlers"]
    assert len(inv["settings_subtabs"]) == 10
    assert len(inv["portals"]) == 8


def test_check_flags_unmapped_handler(tmp_path):
    m = tmp_path / "m.json"
    m.write_text('{"cases": {}, "exempt": {}}')
    res = check(str(pathlib.Path(__file__).parents[3]), str(m))
    assert "Blackout.deteksi" in res["unclassified"]


def test_check_requires_evidence(tmp_path):
    root = tmp_path / "root"
    (root / "app/templates/kasir").mkdir(parents=True)
    (root / "app/templates/kasir/a.html").write_text('<button onclick="Foo.bar()">x</button>')
    m = tmp_path / "m.json"
    m.write_text('{"cases": {"Foo.bar": "K-FOO-01"}, "exempt": {}}')
    ev = tmp_path / "e.json"
    ev.write_text('{"tested": {}, "exempt": {}}')
    res = check(str(root), str(m), str(ev))
    assert res["missing_evidence"] == ["Foo.bar"]
    ev.write_text('{"tested": {"Foo.bar": "K-FOO-01"}, "exempt": {}}')
    res = check(str(root), str(m), str(ev))
    assert res["missing_evidence"] == []
