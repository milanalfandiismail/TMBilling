"""Paket rilis publik tidak boleh membawa screenshot runtime."""

import zipfile

import build_release


def test_release_zip_excludes_legacy_screenshots(tmp_path, monkeypatch):
    project = tmp_path / "proj"
    screenshots = project / "app" / "static" / "uploads" / "screenshots"
    screenshots.mkdir(parents=True)
    (project / "app" / "config.py").write_text('VERSION = "9.9.9"', encoding="utf-8")
    (project / "app" / "core.py").write_text("x", encoding="utf-8")
    (screenshots / "PC-A.png").write_bytes(b"png")
    (project / "install_scripts").mkdir()
    (project / "migrations").mkdir()

    monkeypatch.setattr(build_release, "__file__", str(project / "build_release.py"))
    monkeypatch.setattr(build_release, "compile_csharp", lambda project_dir: True)
    monkeypatch.setattr(build_release, "missing_required", lambda project_dir: [])
    monkeypatch.setattr(build_release, "stale_css", lambda project_dir: False)

    build_release.main()

    with zipfile.ZipFile(project / "TMBilling_Server_v9.9.9.zip") as zf:
        names = {name.replace("\\", "/") for name in zf.namelist()}

    assert "app/core.py" in names
    assert "app/static/uploads/screenshots/PC-A.png" not in names
