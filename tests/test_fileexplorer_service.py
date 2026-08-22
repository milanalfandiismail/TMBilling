# tests/test_fileexplorer_service.py
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

def test_allowed_roots_default_and_custom(app_ctx):
    roots = FileExplorerService.get_allowed_roots()
    assert len(roots) >= 1
    
    with tempfile.TemporaryDirectory() as tmpdir:
        real_tmpdir = os.path.realpath(tmpdir)
        updated = FileExplorerService.set_allowed_roots([real_tmpdir])
        assert real_tmpdir in updated
        assert FileExplorerService.get_allowed_roots() == [real_tmpdir]

def test_path_validation_and_traversal_defense(app_ctx):
    with tempfile.TemporaryDirectory() as tmpdir:
        real_tmpdir = os.path.realpath(tmpdir)
        FileExplorerService.set_allowed_roots([real_tmpdir])
        
        # Path valid di dalam root
        valid_path = os.path.join(real_tmpdir, "test.txt")
        resolved = FileExplorerService.validate_path(valid_path)
        assert resolved == os.path.realpath(valid_path)
        
        # Path traversal ke luar root
        traversal_path = os.path.join(real_tmpdir, "..", "outside.txt")
        with pytest.raises(PermissionError):
            FileExplorerService.validate_path(traversal_path)

def test_file_crud_operations(app_ctx):
    with tempfile.TemporaryDirectory() as tmpdir:
        real_tmpdir = os.path.realpath(tmpdir)
        FileExplorerService.set_allowed_roots([real_tmpdir])
        
        # Create file
        res = FileExplorerService.create_item(real_tmpdir, "hello.txt", is_dir=False)
        assert res["success"] is True
        file_path = res["path"]
        
        # Save content
        save_res = FileExplorerService.save_file(file_path, "Hello World\nLine 2")
        assert save_res["success"] is True
        mtime = save_res["mtime"]
        
        # Read content
        read_res = FileExplorerService.read_file(file_path)
        assert read_res["content"] == "Hello World\nLine 2"
        assert read_res["editable"] is True
        
        # Rename file
        ren_res = FileExplorerService.rename_item(file_path, "greeting.txt")
        assert ren_res["success"] is True
        new_path = ren_res["path"]
        assert os.path.basename(new_path) == "greeting.txt"
        
        # Delete file
        del_res = FileExplorerService.delete_item(new_path)
        assert del_res["success"] is True
        assert not os.path.exists(new_path)
