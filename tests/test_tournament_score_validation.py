import pytest

from app import create_app
from app.models import db, TurnamenMatch
from app.services.tournament.tournament_service import TournamentService


@pytest.fixture
def app_ctx(tmp_path):
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path/'score.db'}",
    })
    with app.app_context():
        db.create_all()
        t1 = TournamentService.create_tournament({"nama": "Cup A", "teams": ["A", "B"]})
        t2 = TournamentService.create_tournament({"nama": "Cup B", "teams": ["X", "Y"]})
        d1 = TournamentService.get_tournament_detail(t1["tournament_id"])
        d2 = TournamentService.get_tournament_detail(t2["tournament_id"])
        match_id = d1["matches"][d1["stages"][0]["id"]][0]["id"]
        yield db.session.get(TurnamenMatch, match_id), d2["teams"][0]
        db.session.remove()
        db.drop_all()


def test_pemenang_asing_ditolak(app_ctx):
    match, tim_lain = app_ctx
    with pytest.raises(ValueError, match="Pemenang"):
        TournamentService.update_match_skor(match.id, {"skor1": 1, "skor2": 0, "pemenang_id": tim_lain["id"]})
    db.session.refresh(match)
    assert match.pemenang_id is None


def test_match_selesai_tidak_bisa_ditimpa(app_ctx):
    match, _ = app_ctx
    TournamentService.update_match_skor(match.id, {"skor1": 1, "skor2": 0})
    with pytest.raises(ValueError, match="selesai"):
        TournamentService.update_match_skor(match.id, {"skor1": 0, "skor2": 1})
