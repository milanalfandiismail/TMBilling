import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from scenario import count, menit, sesi_aktif, stok

DB = str(pathlib.Path(__file__).parents[3] / "instance/e2e/mcp-rust/instance/warnet.db")


def test_seed_has_scenario_data():
    assert menit(DB, 1) == 120
    assert stok(DB, 1) == 20
    assert stok(DB, 3) == 0
    assert sesi_aktif(DB, "PC-02") is not None
    assert count(DB, "pc") == 5
