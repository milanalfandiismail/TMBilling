import pytest
import json
from app import create_app
from app.services.tournament.tournament_service import TournamentService
from app.services.game.game_service import GameService
from app.utils.logger import LOG_FILE

def test_tournament_and_game_logging():
    app = create_app()
    with app.app_context():
        # 1. Test Game creation logging
        try:
            from app.models import Game
            g = Game(
                nama="Audit Game Test",
                kategori="Action",
                exe_path="C:\\Games\\audit.exe",
                argumen=""
            )
            # Just call logic or CRUD to trigger
            GameService.create({
                "nama": "Audit Game Test",
                "kategori": "Action",
                "exe_path": "C:\\Games\\audit.exe",
                "argumen": ""
            }, operator="admin_test")
        except Exception:
            pass

        with open(LOG_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()

        logs = [json.loads(line) for line in lines if line.strip().startswith("{")]
        actions = [l["action"] for l in logs]
        
        assert "GAME_CREATE" in actions
        
        latest_game_log = [l for l in logs if l["action"] == "GAME_CREATE"][-1]
        assert latest_game_log["user"] == "admin_test"
        assert latest_game_log["detail_json"] is not None
        assert latest_game_log["detail_json"]["nama"] == "Audit Game Test"
