# app/models/game/game.py

from app.models.base.base import db, now_local

class Game(db.Model):
    """Model untuk daftar game.
    
    Attributes:
        id (int): Primary key.
        nama (str): Nama game (unik).
        kategori (str): Kategori game (e.g., FPS, MOBA, RPG).
        status (str): Status game (Ready, Updating, Maintenance, Coming Soon).
        exe_path (str): Path executable game di client (untuk launcher di masa depan).
        argumen (str): Argumen untuk meluncurkan game (untuk launcher di masa depan).
        icon_url (str): Path relatif gambar/icon game.
        deskripsi (str): Deskripsi singkat game.
        developer (str): Developer/publisher game.
        file_size (str): Ukuran file game (e.g. 50 GB).
        aktif (bool): Status aktif/tampil di halaman publik.
        dibuat_pada (datetime): Tanggal pembuatan record.
    """
    __tablename__ = "game"

    id = db.Column(db.Integer, primary_key=True)
    nama = db.Column(db.String(100), nullable=False, unique=True)
    kategori = db.Column(db.String(50), nullable=False, default="Casual")
    exe_path = db.Column(db.String(255), nullable=True)
    argumen = db.Column(db.String(255), nullable=True)
    icon_url = db.Column(db.String(255), nullable=True)
    aktif = db.Column(db.Boolean, default=True)
    dibuat_pada = db.Column(db.DateTime, default=now_local)

    def to_dict(self):
        return {
            "id": self.id,
            "nama": self.nama,
            "kategori": self.kategori,
            "status": self.status,
            "exe_path": self.exe_path,
            "argumen": self.argumen,
            "icon_url": self.icon_url,
            "deskripsi": self.deskripsi,
            "developer": self.developer,
            "file_size": self.file_size,
            "aktif": self.aktif,
            "dibuat_pada": self.dibuat_pada.strftime("%d/%m/%Y %H:%M:%S") if self.dibuat_pada else None
        }
