# app/models/maintenance/maintenance.py

"""Model untuk tiket perawatan/masalah PC.

Model ini merepresentasikan data perbaikan PC, pencatatan status tiket,
resolusi masalah, dan pelacakan biaya perbaikan untuk analitik warnet.
"""

from app.models import db, now_local
from app.utils.timezone_utils import format_display

class MaintenanceTicket(db.Model):
    __tablename__ = "maintenance_ticket"

    id              = db.Column(db.Integer, primary_key=True)
    pc_id           = db.Column(db.Integer, db.ForeignKey("pc.id"), nullable=False)
    reporter        = db.Column(db.String(50), nullable=False)        # username pelapor
    kategori        = db.Column(db.String(30), nullable=False)        # "HARDWARE" | "SOFTWARE" | "JARINGAN" | "LAINNYA"
    prioritas       = db.Column(db.String(10), default="SEDANG")      # "RENDAH" | "SEDANG" | "TINGGI" | "KRITIS"
    judul           = db.Column(db.String(150), nullable=False)       # judul singkat
    deskripsi       = db.Column(db.Text, nullable=True)               # detail masalah
    status          = db.Column(db.String(20), default="BARU")        # "BARU" | "DIPROSES" | "SELESAI" | "DITOLAK"
    resolusi        = db.Column(db.Text, nullable=True)               # catatan perbaikan
    biaya           = db.Column(db.Integer, default=0)                # biaya perbaikan Rp
    created_at      = db.Column(db.DateTime, default=now_local)
    updated_at      = db.Column(db.DateTime, default=now_local, onupdate=now_local)
    resolved_at     = db.Column(db.DateTime, nullable=True)           # waktu selesai
    resolved_by     = db.Column(db.String(50), nullable=True)         # username penanggung jawab

    # Relationship
    pc = db.relationship("PC", backref=db.backref("maintenance_tickets", lazy="dynamic"))

    def to_dict(self):
        return {
            "id": self.id,
            "pc_id": self.pc_id,
            "pc_kode": self.pc.kode if self.pc else "N/A",
            "reporter": self.reporter,
            "kategori": self.kategori,
            "prioritas": self.prioritas,
            "judul": self.judul,
            "deskripsi": self.deskripsi or "",
            "status": self.status,
            "resolusi": self.resolusi or "",
            "biaya": self.biaya,
            "created_at": format_display(self.created_at) if self.created_at else None,
            "resolved_at": format_display(self.resolved_at) if self.resolved_at else None,
            "resolved_by": self.resolved_by or ""
        }
