# tests/test_game_public_pagination.py
import pytest

from app import create_app
from app.models import db
from app.models.game.game import Game


@pytest.fixture
def client():
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
    })
    with app.app_context():
        db.create_all()
        for nama in ["Alpha", "Bravo", "Charlie", "Delta"]:
            db.session.add(Game(nama=nama, tipe="game", kategori="Action", aktif=True))
        db.session.commit()
        with app.test_client() as c:
            yield c
        db.session.remove()
        db.drop_all()


def test_without_limit_returns_all_games(client):
    res = client.get("/api/v1/public/game/all")
    assert res.status_code == 200
    body = res.get_json()
    assert body["success"] is True
    assert [g["nama"] for g in body["data"]] == ["Alpha", "Bravo", "Charlie", "Delta"]


def test_limit_two_keeps_order(client):
    res = client.get("/api/v1/public/game/all?limit=2")
    assert res.status_code == 200
    assert [g["nama"] for g in res.get_json()["data"]] == ["Alpha", "Bravo"]


@pytest.mark.parametrize("qs", ["limit=abc", "limit=-1", "offset=abc", "offset=-5"])
def test_invalid_pagination_params_fall_back_to_all(client, qs):
    res = client.get(f"/api/v1/public/game/all?{qs}")
    assert res.status_code == 200
    assert len(res.get_json()["data"]) == 4
