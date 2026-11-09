from app.routes.monitor.screenshot_routes import _upload_folder


def test_screenshot_folder_follows_static_folder(tmp_path):
    from app import create_app
    app = create_app({"TESTING": True, "SECRET_KEY": "test-upload-path"})
    app.static_folder = str(tmp_path)
    with app.app_context():
        assert _upload_folder() == str(tmp_path / "uploads" / "screenshots")
