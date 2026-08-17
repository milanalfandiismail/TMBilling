# app/models/pc/pc_uptime.py

"""Model untuk mencatat log harian uptime PC client.

Module ini menyimpan data akumulasi waktu online (heartbeat)
dan waktu terpakai (billing) untuk setiap PC per tanggal.
"""

from app.models import db


class PCUptimeLog(db.Model):
    """Model untuk mencatat statistik uptime dan utilisasi harian per PC.
    
    Attributes:
        id (int): Primary key log.
        pc_id (int): Foreign key ke tabel PC.
        tanggal (date): Tanggal pencatatan.
        total_online_seconds (int): Akumulasi detik PC berstatus online (heartbeat aktif).
        total_billing_seconds (int): Akumulasi detik PC dipakai dalam sesi billing.
        first_seen (datetime): Waktu pertama kali PC terdeteksi aktif pada hari tersebut.
        last_seen (datetime): Waktu terakhir kali PC mengirim heartbeat telemetry.
    """
    
    __tablename__ = "pc_uptime_log"
    __table_args__ = (
        db.UniqueConstraint("pc_id", "tanggal", name="uq_pc_uptime_pc_tanggal"),
    )
    
    id = db.Column(db.Integer, primary_key=True)
    pc_id = db.Column(db.Integer, db.ForeignKey("pc.id"), nullable=False)
    tanggal = db.Column(db.Date, nullable=False)
    total_online_seconds = db.Column(db.Integer, default=0, nullable=False)
    total_billing_seconds = db.Column(db.Integer, default=0, nullable=False)
    first_seen = db.Column(db.DateTime, nullable=True)
    last_seen = db.Column(db.DateTime, nullable=True)
    
    # Relasi ke PC
    pc = db.relationship("PC", backref=db.backref("uptime_logs", lazy="dynamic"))
    
    def to_dict(self):
        """Mengkonversi objek log uptime ke dictionary.
        
        Returns:
            dict: Detail data uptime log.
        """
        online_menit = round(self.total_online_seconds / 60, 1)
        billing_menit = round(self.total_billing_seconds / 60, 1)
        
        utilisasi = 0.0
        if self.total_online_seconds > 0:
            utilisasi = round((self.total_billing_seconds / self.total_online_seconds) * 100, 1)
            if utilisasi > 100.0:
                utilisasi = 100.0

        grup_nama = self.pc.grup.nama if self.pc and self.pc.grup else "reguler"
        return {
            "id": self.id,
            "pc_id": self.pc_id,
            "pc_kode": self.pc.kode if self.pc else "Unknown",
            "grup": grup_nama,
            "tanggal": self.tanggal.isoformat() if self.tanggal else None,
            "total_online_menit": online_menit,
            "total_billing_menit": billing_menit,
            "total_online_seconds": self.total_online_seconds,
            "total_billing_seconds": self.total_billing_seconds,
            "first_seen": self.first_seen.isoformat() if self.first_seen else None,
            "last_seen": self.last_seen.isoformat() if self.last_seen else None,
            "utilisasi_persen": utilisasi
        }
