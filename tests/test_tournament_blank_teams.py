import pytest

from app import create_app
from app.models import db, Turnamen
from app.services.tournament.tournament_service import TournamentService


@pytest.fixture
def app_ctx(tmp_path):
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path/'teams.db'}",
    })
    with app.app_context():
        db.create_all()
        yield
        db.session.remove()
        db.drop_all()


def test_dua_nama_dengan_satu_kosong_ditolak(app_ctx):
    with pytest.raises(ValueError, match="2 tim"):
        TournamentService.create_tournament({"nama": "Cup", "teams": ["A", "  "]})
    assert Turnamen.query.filter_by(nama="Cup").first() is None
