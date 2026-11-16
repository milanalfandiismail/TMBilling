from io import BytesIO
import os
from werkzeug.datastructures import FileStorage
from app import create_app, db
from app.services.game.game_service import GameService


def test_ikon_disimpan_di_static_folder(tmp_path, monkeypatch):
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    app.static_folder = str(tmp_path / "static")
    monkeypatch.chdir(tmp_path)
    with app.app_context():
        db.create_all()
        file = FileStorage(stream=BytesIO(b"gambar"), filename="ikon.png")

        name = GameService._save_icon(file)

        assert name is not None
        assert os.path.exists(os.path.join(app.static_folder, "uploads", "games", name))
