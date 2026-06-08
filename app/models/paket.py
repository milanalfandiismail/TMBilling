# app/models/paket.py

"""Model untuk paket harga dan durasi bermain.

Module ini mendefinisikan entitas Paket yang merepresentasikan
opsi paket (1 jam, 3 jam, dll) dengan harga, durasi, dan
masa berlaku tertentu.
"""

from app.models.base import db, now_local


class Paket(db.Model):
    """Model untuk paket harga dan durasi bermain.
    
    Model ini mendefinisikan berbagai paket yang tersedia (contoh: 1 jam, 3 jam)
    dengan harga dan durasi tertentu, serta grup targetnya.
    
    Attributes:
        id (int): Primary key paket.
        nama (str): Nama unik paket (contoh: "Paket 1 Jam").
        durasi_menit (int): Durasi paket dalam menit.
        harga (int): Harga paket dalam Rupiah.
        kadaluarsa_hari (int): Lama paket valid setelah pembelian (hari).
        grup_id (int): Foreign key ke tabel grup.
        aktif (bool): Status ketersediaan paket.
        dibuat_pada (datetime): Timestamp pembuatan record.
    """
    
    __tablename__ = "paket"
    
    id = db.Column(db.Integer, primary_key=True)
    nama = db.Column(db.String(100), nullable=False, unique=True)
    durasi_menit = db.Column(db.Integer, nullable=False)
    harga = db.Column(db.Integer, nullable=False)
    kadaluarsa_hari = db.Column(db.Integer, default=30)
    
    # Relasi ke Tabel Grup
    grup_id = db.Column(db.Integer, db.ForeignKey("grup.id"), nullable=False)
    grup = db.relationship("Grup", backref="paket_list")
    
    aktif = db.Column(db.Boolean, default=True)
    dibuat_pada = db.Column(db.DateTime, default=now_local)
    
    def to_dict(self):
        """Mengkonversi data paket ke format dictionary untuk JSON serialization.
        
        Returns:
            dict: Dictionary berisi detail paket dengan nama grup sebagai string.
        """
        return {
            "id": self.id,
            "nama": self.nama,
            "durasi_menit": self.durasi_menit,
            "harga": self.harga,
            "kadaluarsa_hari": self.kadaluarsa_hari,
            "grup": self.grup.nama if self.grup else "reguler", 
            "aktif": self.aktif,
        }