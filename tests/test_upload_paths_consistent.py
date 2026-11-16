from app.routes.monitor.screenshot_routes import _upload_folder


def test_screenshot_folder_is_private_not_static(tmp_path):
    from app import create_app
    instance = tmp_path / "instance"
    app = create_app({
        "TESTING": True,
        "SECRET_KEY": "test-upload-path",
        "INSTANCE_PATH": str(instance),
    })
    with app.app_context():
        folder = _upload_folder()
        assert folder == str(instance / "uploads" / "screenshots")
        assert not folder.startswith(str(app.static_folder))
