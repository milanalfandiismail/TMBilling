import importlib.util
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("allcore_search", ROOT / "scripts" / "allcore_search.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_files_under_skips_vcs_and_binary(tmp_path):
    (tmp_path / "app").mkdir()
    (tmp_path / "app" / "main.py").write_text("buka_member\n", encoding="utf-8")
    (tmp_path / ".git").mkdir()
    (tmp_path / ".git" / "config").write_text("buka_member\n", encoding="utf-8")
    (tmp_path / "logo.png").write_bytes(b"\x89PNG\r\n")
    names = [pathlib.Path(p).name for p in module.files_under(str(tmp_path))]
    assert "main.py" in names
    assert "config" not in names
    assert "logo.png" not in names


def test_search_is_case_insensitive_and_reports_line(tmp_path):
    target = tmp_path / "service.py"
    target.write_text("def buka_member():\n    pass\n", encoding="utf-8")
    path, hits = module.search((str(target), ["buka_member"]))
    assert path == str(target)
    assert hits == [(1, "def buka_member():")]
