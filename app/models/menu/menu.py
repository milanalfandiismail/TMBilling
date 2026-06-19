# app/models/menu.py

"""Model untuk POS Makanan & Minuman (F&B) warnet.

Module ini mendefinisikan entitas MenuItem untuk katalog menu makanan/minuman,
serta TransaksiMenu untuk mencatat transaksi penjualan F&B secara terpisah dari billing PC.
"""

from app.models import db, now_local

class MenuItem(db.Model):
    """Model untuk menyimpan daftar makanan/minuman di katalog POS."""

    __tablename__ = "menu_item"

    id = db.Column(db.Integer, primary_key=True)
    nama = db.Column(db.String(100), nullable=False, unique=True)
    harga = db.Column(db.Integer, nullable=False, default=0)
    stok = db.Column(db.Integer, nullable=False, default=0)
    gambar_path = db.Column(db.String(255), nullable=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True, server_default=db.text("1"))

    def to_dict(self):
        """Konversi objek menu ke dictionary."""
        return {
            "id": self.id,
            "nama": self.nama,
            "harga": self.harga,
            "stok": self.stok,
            "gambar_path": self.gambar_path,
            "is_active": self.is_active,
        }

class TransaksiMenu(db.Model):
    """Model untuk mencatat penjualan makanan/minuman yang diproses kasir."""
    
    __tablename__ = "transaksi_menu"
    
    id = db.Column(db.Integer, primary_key=True)
    no_nota = db.Column(db.String(50), nullable=False, unique=True)
    
    menu_id = db.Column(db.Integer, db.ForeignKey("menu_item.id"), nullable=False)
    jumlah = db.Column(db.Integer, nullable=False, default=1)
    total_harga = db.Column(db.Integer, nullable=False, default=0)
    
    pc_kode = db.Column(db.String(20), nullable=True) # Penanda opsional PC pemesan
    tanggal = db.Column(db.DateTime, default=now_local)
    
    kasir_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)

    # Kolom pembayaran
    tunai = db.Column(db.Integer, nullable=True, default=0)
    kembalian = db.Column(db.Integer, nullable=True, default=0)

    # Relasi
    menu = db.relationship("MenuItem", backref=db.backref("transaksi", lazy=True))
    kasir = db.relationship("User", backref=db.backref("transaksi_menu", lazy=True))

    def to_dict(self):
        """Konversi objek transaksi menu ke dictionary."""
        return {
            "id": self.id,
            "no_nota": self.no_nota,
            "menu_id": self.menu_id,
            "menu_nama": self.menu.nama if self.menu else "Menu Terhapus",
            "menu_harga": self.menu.harga if self.menu else 0,
            "jumlah": self.jumlah,
            "total_harga": self.total_harga,
            "pc_kode": self.pc_kode,
            "tanggal": self.tanggal.strftime("%Y-%m-%d %H:%M:%S") if self.tanggal else None,
            "kasir_id": self.kasir_id,
            "kasir_nama": self.kasir.username if self.kasir else "System",
            "tunai": self.tunai,
            "kembalian": self.kembalian,
        }
