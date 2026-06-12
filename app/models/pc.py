# app/models/pc.py

"""Model untuk unit komputer/client warnet.

Module ini mendefinisikan entitas PC yang merepresentasikan
setiap unit komputer fisik, termasuk identifikasi jaringan
(IP/MAC), zona/grup, dan status penggunaan real-time.
"""

from app.models.base import db


class PC(db.Model):
    """Model untuk mengelola data komputer/klien warnet.
    
    Model ini merepresentasikan setiap unit PC yang tersedia,
    termasuk identifikasi, lokasi/jaringan, dan status penggunaan.
    
    Attributes:
        id (int): Primary key PC.
        kode (str): Kode unik identifikasi PC (contoh: "PC01").
        nama (str): Nama display PC.
        ip_address (str): Alamat IP PC dalam jaringan lokal.
        mac_address (str): Alamat MAC hardware PC.
        grup_id (int): Foreign key ke tabel grup (reguler/vip/vvip).
        zona (str): Zona fisik/lokasi PC (legacy, sekarang mengikuti grup).
        last_activity (datetime): Timestamp aktivitas terakhir.
        aktif (bool): Status PC aktif/nonaktif (maintenance).
        
    Properties:
        zona_nama (str): Property dinamis yang mengembalikan nama grup sebagai zona.
        sesi_aktif (Sesi): Property yang mengembalikan sesi aktif saat ini jika ada.
    """
    
    __tablename__ = "pc"
    
    id = db.Column(db.Integer, primary_key=True)
    kode = db.Column(db.String(20), unique=True, nullable=False)
    nama = db.Column(db.String(50))
    ip_address = db.Column(db.String(15), nullable=True)
    mac_address = db.Column(db.String(17), nullable=True)
    
    # Relasi ke Tabel Grup
    grup_id = db.Column(db.Integer, db.ForeignKey("grup.id"), nullable=False)
    grup = db.relationship("Grup", backref="pc_list")
    
    # Relasi ke Sesi
    sesi_list = db.relationship('Sesi', back_populates='pc', lazy='dynamic')    
    
    zona = db.Column(db.String(50), default="reguler")
    last_activity = db.Column(db.DateTime, nullable=True)
    aktif = db.Column(db.Boolean, default=True)
    is_admin_mode = db.Column(db.Boolean, default=False)

    @property
    def zona_nama(self):
        """Mendapatkan nama zona berdasarkan grup.
        
        Returns:
            str: Nama grup sebagai zona, default "reguler" jika tidak ada grup.
        """
        return self.grup.nama if self.grup else "reguler"
    
    @property
    def sesi_aktif(self):
        """Mencari sesi yang sedang aktif di PC ini.
        Diambil yang paling baru (ID terbesar).
        
        Returns:
            Sesi atau None: Objek sesi aktif jika ada, None jika PC kosong.
        """
        return self.sesi_list.filter_by(status="aktif").order_by(db.text('id DESC')).first()
    
    def to_dict(self):
        """Mengkonversi data PC ke format dictionary untuk API response.
        
        Returns:
            dict: Dictionary berisi detail PC, status penggunaan, dan info sesi aktif.
        """
        import os
        from flask import current_app
        from datetime import datetime

        s = self.sesi_aktif

        screenshot_path = os.path.join(current_app.root_path, 'static', 'uploads', 'screenshots', f"{self.kode}.png")
        has_screenshot = os.path.exists(screenshot_path)
        screenshot_time = None
        if has_screenshot:
            try:
                mtime = os.path.getmtime(screenshot_path)
                screenshot_time = datetime.fromtimestamp(mtime).strftime("%d/%m/%Y %H:%M:%S")
            except Exception:
                pass

        return {
            "id": self.id,
            "kode": self.kode,
            "nama": self.nama,
            "ip_address": self.ip_address,
            "mac_address": self.mac_address,
            "grup": self.grup.nama if self.grup else "reguler", 
            "zona": self.zona_nama,
            "aktif": self.aktif,
            "status": "terpakai" if s else ("admin" if self.is_admin_mode else "kosong"),
            "sesi_id": s.id if s else None,
            "is_admin_mode": self.is_admin_mode,
            "screenshot_url": f"/static/uploads/screenshots/{self.kode}.png" if has_screenshot else None,
            "screenshot_time": screenshot_time
        }
