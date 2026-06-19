# app/models/grup.py

"""Model untuk grup/kategori pengelompokan resource warnet.

Module ini mendefinisikan entitas Grup yang digunakan untuk
mengelompokkan PC, Member, dan Paket ke dalam zona
(reguler, vip, vvip, dll).
"""

from app.models import db, now_local


class Grup(db.Model):
    """Model untuk grup/kategori PC, Member, dan Paket.
    
    Model ini digunakan untuk mengelompokkan resources (PC, Member, Paket)
    ke dalam kategori seperti reguler, vip, vvip, dll.
    
    Attributes:
        id (int): Primary key grup.
        nama (str): Nama unik grup (lowercase).
        keterangan (str): Deskripsi tambahan grup.
        dibuat_pada (datetime): Timestamp pembuatan record.
        
    Relationships:
        member_list: Relationship ke Member yang termasuk grup ini.
        paket_list: Relationship ke Paket yang termasuk grup ini.
        pc_list: Relationship ke PC yang termasuk grup ini.
    """
    
    __tablename__ = 'grup'
    
    id = db.Column(db.Integer, primary_key=True)
    nama = db.Column(db.String(50), unique=True, nullable=False)
    warna = db.Column(db.String(20), default="#888888")
    keterangan = db.Column(db.String(255), nullable=True)
    dibuat_pada = db.Column(db.DateTime, default=now_local)

    def __init__(self, nama, keterangan=None, warna="#888888"):
        """Inisialisasi instance Grup.
        
        Args:
            nama (str): Nama grup. Akan dikonversi ke lowercase dan di-strip.
            keterangan (str, optional): Deskripsi grup. Defaults to None.
            warna (str, optional): Hex color code. Defaults to #888888.
        """
        self.nama = nama.lower().strip()
        self.keterangan = keterangan
        self.warna = warna or "#888888"