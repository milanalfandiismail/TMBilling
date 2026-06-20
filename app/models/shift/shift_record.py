"""Model untuk sesi shift kasir (Handover).

Module ini mendefinisikan entitas ShiftRecord yang melacak aktivitas
pergantian shift kasir, termasuk modal awal, total pendapatan, uang fisik,
dan selisih untuk audit keuangan.
"""

from app.models import db, now_local
from app.utils.timezone_utils import format_display


class ShiftRecord(db.Model):
    """Model untuk mencatat sesi shift kasir.

    Attributes:
        id (int): Primary key shift.
        kasir_id (int): Foreign key ke User (kasir yang membuka shift).
        waktu_mulai (datetime): Waktu buka shift.
        waktu_selesai (datetime): Waktu tutup shift (nullable, diisi saat tutup).
        modal_awal (int): Uang kembalian di laci saat buka shift.
        total_billing (int): Total pendapatan billing PC selama shift.
        total_kantin (int): Total pendapatan kantin/F&B selama shift.
        uang_fisik (int): Uang yang dilaporkan kasir saat tutup shift.
        selisih (int): uang_fisik - (modal_awal + total_billing + total_kantin).
        status (str): 'AKTIF' atau 'SELESAI'.
    """

    __tablename__ = "shift_record"

    id = db.Column(db.Integer, primary_key=True)
    kasir_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)

    waktu_mulai = db.Column(db.DateTime, default=now_local, nullable=False)
    waktu_selesai = db.Column(db.DateTime, nullable=True)

    modal_awal = db.Column(db.Integer, default=0, nullable=False)
    total_billing = db.Column(db.Integer, default=0)
    total_kantin = db.Column(db.Integer, default=0)
    uang_fisik = db.Column(db.Integer, nullable=True)
    selisih = db.Column(db.Integer, nullable=True)

    status = db.Column(db.String(10), default="AKTIF", nullable=False)

    # Relationship
    kasir = db.relationship("User", backref=db.backref("shift_list", lazy="dynamic"))

    def to_dict(self):
        return {
            "id": self.id,
            "kasir_id": self.kasir_id,
            "kasir_nama": self.kasir.nama_lengkap or self.kasir.username if self.kasir else "System",
            "waktu_mulai": format_display(self.waktu_mulai) if self.waktu_mulai else None,
            "waktu_selesai": format_display(self.waktu_selesai) if self.waktu_selesai else None,
            "modal_awal": self.modal_awal,
            "total_billing": self.total_billing,
            "total_kantin": self.total_kantin,
            "uang_fisik": self.uang_fisik,
            "selisih": self.selisih,
            "status": self.status,
            "total_pendapatan": self.total_billing + self.total_kantin,
        }
