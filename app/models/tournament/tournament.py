# app/models/tournament.py

"""Model untuk sistem manajemen Turnamen TMBilling.

Modul ini mendefinisikan entitas Turnamen, TurnamenTahap (Stage), 
TurnamenTim (Team), dan TurnamenMatch (Match) untuk melacak data turnamen 
secara relasional di SQLite.
"""

from app.models import db, now_local
from app.utils.timezone_utils import format_display

class Turnamen(db.Model):
    """Model untuk menyimpan informasi utama turnamen."""
    
    __tablename__ = 'turnamen'
    
    id = db.Column(db.Integer, primary_key=True)
    nama = db.Column(db.String(100), unique=True, nullable=False)
    deskripsi = db.Column(db.String(255), nullable=True)
    status = db.Column(db.String(20), default="draft") # draft, aktif, selesai
    dibuat_pada = db.Column(db.DateTime, default=now_local)

    # Relasi
    stages = db.relationship("TurnamenTahap", backref="turnamen", cascade="all, delete-orphan", lazy=True)
    teams = db.relationship("TurnamenTim", backref="turnamen", cascade="all, delete-orphan", lazy=True)
    matches = db.relationship("TurnamenMatch", backref="turnamen", cascade="all, delete-orphan", lazy=True)

    def to_dict(self):
        """Konversi objek turnamen ke dictionary."""
        return {
            "id": self.id,
            "nama": self.nama,
            "deskripsi": self.deskripsi,
            "status": self.status,
            "dibuat_pada": format_display(self.dibuat_pada) if self.dibuat_pada else None
        }


class TurnamenTahap(db.Model):
    """Model untuk babak/tahap turnamen (misal: Swiss Round-Robin, Playoff Bracket)."""
    
    __tablename__ = 'turnamen_tahap'
    
    id = db.Column(db.Integer, primary_key=True)
    turnamen_id = db.Column(db.Integer, db.ForeignKey('turnamen.id'), nullable=False)
    nama = db.Column(db.String(50), nullable=False) # "Group Stage", "Playoffs", dll.
    tipe_format = db.Column(db.String(20), nullable=False) # "swiss", "single_elimination"
    urutan = db.Column(db.Integer, nullable=False, default=1)
    status = db.Column(db.String(20), default="draft") # draft, aktif, selesai
    dibuat_pada = db.Column(db.DateTime, default=now_local)

    # Relasi
    matches = db.relationship("TurnamenMatch", backref="tahap", cascade="all, delete-orphan", lazy=True)

    def to_dict(self):
        """Konversi objek tahap ke dictionary."""
        return {
            "id": self.id,
            "turnamen_id": self.turnamen_id,
            "nama": self.nama,
            "tipe_format": self.tipe_format,
            "urutan": self.urutan,
            "status": self.status,
            "dibuat_pada": format_display(self.dibuat_pada) if self.dibuat_pada else None
        }


class TurnamenTim(db.Model):
    """Model untuk menyimpan tim-tim peserta turnamen."""
    
    __tablename__ = 'turnamen_tim'
    
    id = db.Column(db.Integer, primary_key=True)
    turnamen_id = db.Column(db.Integer, db.ForeignKey('turnamen.id'), nullable=False)
    nama_tim = db.Column(db.String(100), nullable=False)
    status_aktif = db.Column(db.Boolean, default=True)
    dibuat_pada = db.Column(db.DateTime, default=now_local)

    def to_dict(self):
        """Konversi objek tim ke dictionary."""
        return {
            "id": self.id,
            "turnamen_id": self.turnamen_id,
            "nama_tim": self.nama_tim,
            "status_aktif": self.status_aktif
        }


class TurnamenMatch(db.Model):
    """Model untuk detail pertandingan individu."""
    
    __tablename__ = 'turnamen_match'
    
    id = db.Column(db.Integer, primary_key=True)
    turnamen_id = db.Column(db.Integer, db.ForeignKey('turnamen.id'), nullable=False)
    tahap_id = db.Column(db.Integer, db.ForeignKey('turnamen_tahap.id'), nullable=False)
    round_number = db.Column(db.Integer, nullable=False, default=1)
    match_number = db.Column(db.Integer, nullable=False, default=1)
    
    tim1_id = db.Column(db.Integer, db.ForeignKey('turnamen_tim.id', ondelete='SET NULL'), nullable=True)
    tim2_id = db.Column(db.Integer, db.ForeignKey('turnamen_tim.id', ondelete='SET NULL'), nullable=True)
    skor1 = db.Column(db.Integer, default=0)
    skor2 = db.Column(db.Integer, default=0)
    pemenang_id = db.Column(db.Integer, db.ForeignKey('turnamen_tim.id', ondelete='SET NULL'), nullable=True)
    bo_format = db.Column(db.Integer, default=1) # BO1, BO3, BO5, BO7
    next_match_id = db.Column(db.Integer, db.ForeignKey('turnamen_match.id', ondelete='SET NULL'), nullable=True)
    dibuat_pada = db.Column(db.DateTime, default=now_local)

    # Relasi khusus
    tim1 = db.relationship("TurnamenTim", foreign_keys=[tim1_id], backref=db.backref("matches_as_tim1", lazy=True))
    tim2 = db.relationship("TurnamenTim", foreign_keys=[tim2_id], backref=db.backref("matches_as_tim2", lazy=True))
    pemenang = db.relationship("TurnamenTim", foreign_keys=[pemenang_id], backref=db.backref("won_matches", lazy=True))
    next_match = db.relationship("TurnamenMatch", foreign_keys=[next_match_id], remote_side=[id], backref=db.backref("previous_matches", lazy=True))

    def to_dict(self):
        """Konversi objek match ke dictionary."""
        return {
            "id": self.id,
            "turnamen_id": self.turnamen_id,
            "tahap_id": self.tahap_id,
            "round_number": self.round_number,
            "match_number": self.match_number,
            "tim1_id": self.tim1_id,
            "tim2_id": self.tim2_id,
            "tim1_nama": self.tim1.nama_tim if self.tim1 else None,
            "tim2_nama": self.tim2.nama_tim if self.tim2 else None,
            "skor1": self.skor1,
            "skor2": self.skor2,
            "pemenang_id": self.pemenang_id,
            "pemenang_nama": self.pemenang.nama_tim if self.pemenang else None,
            "bo_format": self.bo_format,
            "next_match_id": self.next_match_id
        }
