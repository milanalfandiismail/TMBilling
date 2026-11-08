import os

import pytest

from tests.e2e.e2e_sandbox_server import SandboxPaths, _sandbox_env, sandbox_paths


def test_path_suite_berbeda_untuk_setiap_suite():
    a = sandbox_paths("pc_billing")
    b = sandbox_paths("fnb_pos")
    assert a.db_path != b.db_path
    assert a.notes_dir != b.notes_dir
    assert a.project_root != b.project_root
    assert a.backup_dir != b.backup_dir
    assert a.log_path != b.log_path
    assert "pc_billing" in a.db_path


def test_id_suite_tidak_aman_ditolak():
    with pytest.raises(ValueError):
        sandbox_paths("../warnet")


def test_env_sandbox_menunjuk_path_suite(tmp_path):
    paths = SandboxPaths(
        db_path=str(tmp_path / "warnet.db"),
        notes_dir=str(tmp_path / "notes"),
        project_root=str(tmp_path / "root"),
        backup_dir=str(tmp_path / "backups"),
        log_path=str(tmp_path / "server.log"),
    )
    env = _sandbox_env(paths)
    assert env["DATABASE_URL"] == "sqlite:///" + paths.db_path.replace(os.sep, "/")
    assert env["TM_NOTES_DIR"] == paths.notes_dir
    assert env["PROJECT_ROOT"] == paths.project_root
    assert env["BACKUP_DIR"] == paths.backup_dir
