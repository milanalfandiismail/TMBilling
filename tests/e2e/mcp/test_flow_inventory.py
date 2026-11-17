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
