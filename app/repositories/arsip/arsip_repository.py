# app/repositories/arsip/arsip_repository.py

"""Repository agregat untuk data yang sudah diarsipkan."""

from app.models import db, Game, Grup, Member, MenuItem, Paket, PC, User


class ArsipRepository:
    """Repository class untuk mengambil seluruh data terarsip."""

    @staticmethod
    def get_all_arsip():
        """Mengambil semua baris terarsip dari tujuh entitas."""
        return {
            "grup": Grup.query.filter_by(aktif=False).order_by(Grup.nama.asc()).all(),
            "pc": PC.query.filter_by(aktif=False).order_by(PC.kode.asc()).all(),
            "paket": Paket.query.filter_by(aktif=False).order_by(Paket.nama.asc()).all(),
            "member": Member.query.filter_by(aktif=False).order_by(Member.username.asc()).all(),
            "user": User.query.filter_by(aktif=False).order_by(User.username.asc()).all(),
            "game": Game.query.filter_by(aktif=False).order_by(Game.nama.asc()).all(),
            "menu": MenuItem.query.filter_by(is_active=False).order_by(MenuItem.nama.asc()).all(),
        }
