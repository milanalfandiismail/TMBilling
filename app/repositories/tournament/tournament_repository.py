# app/repositories/tournament/tournament_repository.py

"""Repository untuk entitas Turnamen, Tahap, Tim, dan Match.

Modul ini menangani operasi Data Access Layer untuk seluruh entitas
sistem turnamen bracket maker.
"""

from app.models import db
from app.models import Turnamen, TurnamenTahap, TurnamenTim, TurnamenMatch


class TournamentRepository:
    """Data Access Layer untuk entitas Turnamen."""

    @staticmethod
    def get_all():
        """Ambil semua turnamen urut dari yang terbaru."""
        return Turnamen.query.order_by(Turnamen.dibuat_pada.desc()).all()

    @staticmethod
    def get_by_id(t_id):
        """Ambil turnamen berdasarkan ID."""
        return Turnamen.query.get(t_id)

    @staticmethod
    def get_by_nama(nama):
        """Ambil turnamen berdasarkan nama."""
        return Turnamen.query.filter_by(nama=nama).first()

    @staticmethod
    def get_stage_by_id(stage_id):
        """Ambil stage/tahap turnamen berdasarkan ID."""
        return TurnamenTahap.query.get(stage_id)

    @staticmethod
    def get_match_by_id(match_id):
        """Ambil match/pertandingan berdasarkan ID."""
        return TurnamenMatch.query.get(match_id)

    @staticmethod
    def get_matches_by_stage(stage_id):
        """Ambil semua match pada suatu stage."""
        return TurnamenMatch.query.filter_by(tahap_id=stage_id).order_by(
            TurnamenMatch.round_number, TurnamenMatch.match_number
        ).all()

    @staticmethod
    def get_matches_by_stage_and_round(stage_id, round_number):
        """Ambil match pada stage dan round tertentu."""
        return TurnamenMatch.query.filter_by(tahap_id=stage_id, round_number=round_number).all()

    @staticmethod
    def get_incomplete_matches_in_round(stage_id, round_number):
        """Ambil match yang belum ada pemenangnya pada round tertentu."""
        return TurnamenMatch.query.filter_by(
            tahap_id=stage_id, round_number=round_number
        ).filter(TurnamenMatch.pemenang_id.is_none()).all()

    @staticmethod
    def get_teams_by_ids(team_ids):
        """Ambil daftar tim berdasarkan ID."""
        return TurnamenTim.query.filter(TurnamenTim.id.in_(team_ids)).all()

    @staticmethod
    def save(entity):
        """Simpan entitas ke database."""
        db.session.add(entity)
        return entity

    @staticmethod
    def flush():
        """Flush perubahan ke session untuk mendapatkan ID baru."""
        db.session.flush()

    @staticmethod
    def delete(entity):
        """Hapus entitas dari database."""
        db.session.delete(entity)

    @staticmethod
    def commit():
        """Commit transaksi database."""
        db.session.commit()

    @staticmethod
    def rollback():
        """Rollback transaksi database."""
        db.session.rollback()
