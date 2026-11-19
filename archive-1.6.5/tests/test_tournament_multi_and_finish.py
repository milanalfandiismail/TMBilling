import pytest

from app import create_app
from app.models import db
from app.services.tournament.tournament_service import TournamentService


@pytest.fixture
def app_ctx(tmp_path):
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path/'tournament.db'}",
    })
    with app.app_context():
        db.create_all()
        yield
        db.session.remove()
        db.drop_all()


def test_format_multi_bisa_dibuat(app_ctx):
    result = TournamentService.create_tournament({
        "nama": "Multi Cup", "tipe_jalur": "multi", "teams": ["A", "B", "C", "D"],
    })
    detail = TournamentService.get_tournament_detail(result["tournament_id"])
    assert len(detail["stages"]) == 2


def test_finish_stage_menolak_tim_turnamen_lain(app_ctx):
    t1 = TournamentService.create_tournament({"nama": "Cup A", "teams": ["A", "B"]})
    t2 = TournamentService.create_tournament({"nama": "Cup B", "teams": ["X", "Y"]})
    stage = TournamentService.get_tournament_detail(t1["tournament_id"])["stages"][0]
    tim_lain = TournamentService.get_tournament_detail(t2["tournament_id"])["teams"][0]
    with pytest.raises(ValueError):
        TournamentService.finish_stage(stage["id"], [tim_lain["id"]])
