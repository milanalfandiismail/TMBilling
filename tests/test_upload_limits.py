from app import create_app
from app.routes.monitor.screenshot_routes import _screenshot_filename


def test_batas_upload_dipasang():
    app = create_app({"TESTING": True})
    assert app.config["MAX_CONTENT_LENGTH"] == 64 * 1024 * 1024


def test_nama_file_screenshot_tidak_bisa_keluar_folder():
    assert _screenshot_filename("PC/01") == "PC01.png"
    assert "/" not in _screenshot_filename("../etc")
    assert "\\" not in _screenshot_filename("..\\etc")
