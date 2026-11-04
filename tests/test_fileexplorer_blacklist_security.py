import os
import pytest
from app import create_app
from app.services.fileexplorer.fileexplorer_service import FileExplorerService


def test_fileexplorer_blocks_access_to_sensitive_files():
    """Memastikan FileExplorerService menolak pembacaan, penulisan, atau penghapusan
    terhadap berkas-berkas sensitif seperti .env, warnet.db, initial_admin.txt, dan folder .git."""
    app = create_app()
    with app.app_context():
        cwd = os.getcwd()

        sensitive_targets = [
            os.path.join(cwd, ".env"),
            os.path.join(cwd, "instance", "warnet.db"),
            os.path.join(cwd, "initial_admin.txt"),
            os.path.join(cwd, ".git", "config")
        ]

        for target in sensitive_targets:
            with pytest.raises(PermissionError) as exc_info:
                FileExplorerService.validate_path(target)
            assert "dilindungi" in str(exc_info.value).lower() or "akses ditolak" in str(exc_info.value).lower()


def test_fileexplorer_list_directory_filters_sensitive_entries():
    """Memastikan FileExplorerService.list_directory menyembunyikan berkas sensitif dari daftar."""
    app = create_app()
    with app.app_context():
        cwd = os.getcwd()
        result = FileExplorerService.list_directory(cwd)
        assert result["success"] is True

        item_names = [item["name"].lower() for item in result["items"]]
        assert ".env" not in item_names
        assert ".git" not in item_names
        assert "initial_admin.txt" not in item_names
