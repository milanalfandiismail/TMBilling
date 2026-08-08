# app/routes/tournament_routes.py

"""Blueprint rute API untuk Turnamen Bracket Maker di TMBilling.

Menyediakan API HTTP controller untuk:
1. List & Detail Turnamen
2. Inisialisasi Turnamen Baru (Single Elimination, Swiss Stage, Multi-stage)
3. Update skor & auto-advance pemenang
4. Swiss matchmaking & transisi babak ke Playoffs
5. Hapus Turnamen
"""

from flask import Blueprint, request, jsonify
from app.routes.auth.auth_kasir_routes import login_required, admin_required
from app.services.tournament.tournament_service import TournamentService

tournament_api_bp = Blueprint("tournament", __name__)


# =========================================================================
# API ENDPOINTS
# =========================================================================

@tournament_api_bp.route("/", methods=["GET"])
@login_required
def list_tournament():
    """Mengambil semua daftar turnamen."""
    try:
        tournaments = TournamentService.get_all_tournaments()
        return jsonify({"tournaments": tournaments}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@tournament_api_bp.route("/<int:t_id>", methods=["GET"])
@login_required
def get_tournament(t_id):
    """Mengambil detail lengkap turnamen beserta stage, tim, match, dan klasemen."""
    try:
        detail = TournamentService.get_tournament_detail(t_id)
        return jsonify(detail), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@tournament_api_bp.route("/", methods=["POST"])
@login_required
@admin_required
def create_tournament():
    """Membuat turnamen baru beserta tim dan menginisialisasi stage pertama."""
    try:
        data = request.get_json() or {}
        result = TournamentService.create_tournament(data)
        return jsonify({
            "success": True,
            "message": f"Turnamen '{result['nama']}' berhasil dibuat",
            "tournament_id": result["tournament_id"]
        }), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@tournament_api_bp.route("/match/<int:match_id>/skor", methods=["POST"])
@login_required
@admin_required
def update_match_skor(match_id):
    """Mengupdate skor pertandingan dan meloloskan pemenang ke babak berikutnya."""
    try:
        data = request.get_json() or {}
        match_dict = TournamentService.update_match_skor(match_id, data)
        return jsonify({"success": True, "message": "Skor pertandingan diperbarui", "match": match_dict}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@tournament_api_bp.route("/<int:t_id>/swiss/next", methods=["POST"])
@login_required
@admin_required
def next_swiss_round(t_id):
    """Membuka ronde Swiss berikutnya dan melakukan matchmaking otomatis."""
    try:
        next_round = TournamentService.next_swiss_round(t_id)
        return jsonify({"success": True, "message": f"Ronde {next_round} berhasil dibuat"}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@tournament_api_bp.route("/stage/<int:stage_id>/finish", methods=["POST"])
@login_required
@admin_required
def finish_stage(stage_id):
    """Menyelesaikan stage saat ini dan memajukan tim-tim terpilih ke Playoffs (untuk multi-tahap)."""
    try:
        data = request.get_json() or {}
        msg = TournamentService.finish_stage(stage_id, data.get("qualified_team_ids", []))
        return jsonify({"success": True, "message": msg}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@tournament_api_bp.route("/<int:t_id>", methods=["DELETE"])
@login_required
@admin_required
def delete_tournament(t_id):
    """Menghapus turnamen secara permanen beserta semua data relasinya (cascade)."""
    try:
        nama = TournamentService.delete_tournament(t_id)
        return jsonify({"success": True, "message": f"Turnamen '{nama}' berhasil dihapus"}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500
