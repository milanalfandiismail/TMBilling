# tests/test_fileexplorer_security.py
import os
import tempfile
import pytest
from app import create_app, db
from app.services.fileexplorer.fileexplorer_service import FileExplorerService

@pytest.fixture
def app_ctx():
    app = create_app()
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()

def test_path_traversal_attacks(app_ctx):
    with tempfile.TemporaryDirectory() as tmpdir:
        real_tmpdir = os.path.realpath(tmpdir)
        FileExplorerService.set_allowed_roots([real_tmpdir])
        
        # Test traversing outwards via parent references
        traversal_attempts = [
            os.path.join(real_tmpdir, "..", "some_file.txt"),
            os.path.join(real_tmpdir, "subdir", "..", "..", "outside.txt"),
            real_tmpdir + "_extra",
        ]
        for path in traversal_attempts:
            with pytest.raises(PermissionError):
                FileExplorerService.validate_path(path)

def test_binary_file_detection(app_ctx):
    with tempfile.TemporaryDirectory() as tmpdir:
        real_tmpdir = os.path.realpath(tmpdir)
        FileExplorerService.set_allowed_roots([real_tmpdir])
        
        # 1. Create a binary file (containing null byte)
        bin_path = os.path.join(real_tmpdir, "binary_file.bin")
        with open(bin_path, "wb") as f:
            f.write(b"Some text\x00More binary data")
            
        # 2. Try to read using service
        res = FileExplorerService.read_file(bin_path)
        assert res["editable"] is False
        assert "content" not in res or res["content"] is None
        assert "Gagal membaca: Berkas terdeteksi biner" in res.get("error", "")

def test_large_file_size_limit(app_ctx):
    with tempfile.TemporaryDirectory() as tmpdir:
        real_tmpdir = os.path.realpath(tmpdir)
        FileExplorerService.set_allowed_roots([real_tmpdir])
        
        # Create a file larger than 5MB
        large_path = os.path.join(real_tmpdir, "huge_file.txt")
        with open(large_path, "wb") as f:
            # 5.1 MB of space characters
            f.write(b" " * (5 * 1024 * 1024 + 100 * 1024))
            
        res = FileExplorerService.read_file(large_path)
        assert res["editable"] is False
        assert "content" not in res or res["content"] is None
        assert "melebihi batas ukuran" in res.get("error", "")

def test_save_optimistic_locking_conflict(app_ctx):
    with tempfile.TemporaryDirectory() as tmpdir:
        real_tmpdir = os.path.realpath(tmpdir)
        FileExplorerService.set_allowed_roots([real_tmpdir])
        
        # Create file and save initial content
        res = FileExplorerService.create_item(real_tmpdir, "locked.txt", is_dir=False)
        file_path = res["path"]
        
        save_res = FileExplorerService.save_file(file_path, "Original content")
        initial_mtime = save_res["mtime"]
        
        # Simulating concurrent update: update the file on disk and modify mtime
        with open(file_path, "w", encoding="utf-8") as f:
            f.write("Disk modified content")
        os.utime(file_path, (initial_mtime + 10.0, initial_mtime + 10.0))
            
        # Try to save with the old expected_mtime
        save_res_conflict = FileExplorerService.save_file(
            file_path,
            "Concurrent change attempt",
            expected_mtime=initial_mtime
        )
        assert save_res_conflict["success"] is False
        assert "Conflict" in save_res_conflict.get("error", "")
