from tests.e2e import run_all_e2e as guard


def test_tree_snapshot_mendeteksi_isi_berubah(tmp_path):
    (tmp_path / "a.txt").write_text("awal", encoding="utf-8")
    before = guard.tree_snapshot(str(tmp_path))
    (tmp_path / "a.txt").write_text("berubah", encoding="utf-8")
    after = guard.tree_snapshot(str(tmp_path))
    diffs = guard.snapshot_diff({"notes": before}, {"notes": after})
    assert any("a.txt" in diff for diff in diffs)


def test_tree_snapshot_mendeteksi_berkas_baru(tmp_path):
    before = guard.tree_snapshot(str(tmp_path))
    (tmp_path / "baru.txt").write_text("x", encoding="utf-8")
    after = guard.tree_snapshot(str(tmp_path))
    diffs = guard.snapshot_diff({"backups": before}, {"backups": after})
    assert any("baru.txt" in diff for diff in diffs)


def test_snapshot_diff_db_tetap_kosong():
    before = {"sha256": "a", "tables": {"transaksi": 1}}
    after = {"sha256": "a", "tables": {"transaksi": 1}}
    assert guard.snapshot_diff({"db": before}, {"db": after}) == []
