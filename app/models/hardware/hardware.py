# app/models/hardware.py

"""Model untuk monitoring hardware PC client.

Module ini mendefinisikan entitas HardwareMonitor yang menyimpan
metrik real-time dari C# Hardware Monitor Agent, termasuk
suhu CPU/GPU, penggunaan CPU, spesifikasi RAM, dan info motherboard.
"""

from app.models import db, now_local

class HardwareMonitor(db.Model):
    """Model untuk menyimpan metrik hardware PC dari C# Monitor Agent.
    
    Tabel ini memiliki relasi one-to-one dengan tabel PC.
    Menyimpan status terkini (real-time) dari PC termasuk
    suhu CPU/GPU, penggunaan CPU, info RAM, dan spesifikasi hardware.
    
    Data dikirim secara periodik oleh C# Hardware Monitor Agent
    yang terinstall di setiap PC client.
    
    Attributes:
        id (int): Primary key record hardware.
        pc_id (int): Foreign key unik ke tabel PC (one-to-one).
        cpu_usage (float): Persentase penggunaan CPU (0.0 - 100.0).
        cpu_temp (float): Suhu CPU dalam derajat Celsius.
        gpu_temp (float): Suhu GPU dalam derajat Celsius.
        total_ram (str): Total RAM terpasang (contoh: '16 GB').
        nic_speed (str): Kecepatan Network Interface Card.
        motherboard (str): Nama/model motherboard.
        cpu_name (str): Nama processor.
        gpu_name (str): Nama graphics card.
        last_update (datetime): Timestamp update metrik terakhir.
        
    Relationships:
        pc: Relasi balik ke model PC (one-to-one dengan cascade delete).
    """
    
    __tablename__ = "hardware_monitor"
    
    id = db.Column(db.Integer, primary_key=True)
    pc_id = db.Column(db.Integer, db.ForeignKey("pc.id"), nullable=False, unique=True)
    
    cpu_usage = db.Column(db.Float, default=0.0)
    cpu_temp = db.Column(db.Float, default=0.0)
    gpu_temp = db.Column(db.Float, default=0.0)
    
    total_ram = db.Column(db.String(20))
    nic_speed = db.Column(db.String(20))
    motherboard = db.Column(db.String(100))
    cpu_name = db.Column(db.String(100))
    gpu_name = db.Column(db.String(100))
    
    active_window = db.Column(db.String(255))
    
    last_update = db.Column(db.DateTime, default=now_local, onupdate=now_local)

    # Relasi balik ke PC
    pc = db.relationship("PC", backref=db.backref("hardware", uselist=False, cascade="all, delete-orphan"))

    def to_dict(self):
        """Mengkonversi data hardware monitor ke dictionary.
        
        Returns:
            dict: Dictionary berisi semua metrik hardware dengan
                  timestamp last_update yang sudah di-format.
        """
        return {
            "id": self.id,
            "pc_id": self.pc_id,
            "cpu_usage": self.cpu_usage,
            "cpu_temp": self.cpu_temp,
            "gpu_temp": self.gpu_temp,
            "total_ram": self.total_ram,
            "nic_speed": self.nic_speed,
            "motherboard": self.motherboard,
            "cpu_name": self.cpu_name,
            "gpu_name": self.gpu_name,
            "active_window": self.active_window,
            "last_update": self.last_update.strftime("%Y-%m-%d %H:%M:%S") if self.last_update else None
        }

class PCProcess(db.Model):
    """Model untuk menyimpan daftar proses yang sedang berjalan di PC Client.
    
    Setiap PC dapat memiliki banyak proses yang aktif secara bersamaan.
    Data ini berguna untuk audit keamanan (melihat aplikasi terlarang).
    
    Attributes:
        id (int): Primary key.
        pc_id (int): Foreign key ke tabel PC.
        name (str): Nama file executable proses (misal: 'valorant.exe').
        title (str): Judul jendela aplikasi (misal: 'Valorant - In Game').
        last_update (datetime): Kapan data proses ini terakhir dilaporkan.
    """
    
    __tablename__ = "pc_process"
    
    id = db.Column(db.Integer, primary_key=True)
    pc_id = db.Column(db.Integer, db.ForeignKey("pc.id"), nullable=False)
    
    name = db.Column(db.String(100), nullable=False)
    title = db.Column(db.String(255))
    
    last_update = db.Column(db.DateTime, default=now_local, onupdate=now_local)
    
    # Relasi balik ke PC
    pc = db.relationship("PC", backref=db.backref("processes", lazy=True, cascade="all, delete-orphan"))

    def to_dict(self):
        """Konversi data proses ke dictionary."""
        return {
            "name": self.name,
            "title": self.title,
            "last_update": self.last_update.strftime("%H:%M:%S") if self.last_update else None
        }
