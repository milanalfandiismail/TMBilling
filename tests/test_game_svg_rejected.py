from io import BytesIO
import pytest
from werkzeug.datastructures import FileStorage
from app import create_app, db
from app.services.game.game_service import GameService


@pytest.fixture
def ctx():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        db.create_all()
        yield app


def test_ikon_svg_ditolak(ctx):
    svg = FileStorage(stream=BytesIO(b"<svg><script>alert(1)</script></svg>"),
                      filename="evil.svg")

    with pytest.raises(ValueError, match="svg"):
        GameService.create({"nama": "Game Uji"}, icon_file=svg)
