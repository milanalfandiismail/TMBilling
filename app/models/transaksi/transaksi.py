# app/models/transaksi.py

"""Model untuk pencatatan transaksi keuangan.

Module ini mendefinisikan entitas Transaksi yang mencatat
setiap aktivitas pembelian paket, penambahan waktu, refund,
dan penutupan sesi untuk keperluan laporan keuangan dan audit.
"""

from app.models import db, now_local
from app.utils.timezone_utils import format_display


class Transaksi(db.Model):
    """Model untuk mencatat semua transaksi keuangan.
    
    Model ini merekam setiap aktivitas pembelian paket, penambahan waktu,
    dan aktivitas kasir lainnya untuk keperluan laporan dan audit.
    
    Attributes:
        id (int): Primary key transaksi.
        sesi_id (int): Foreign key ke sesi terkait (jika ada).
        member_id (int): Foreign key ke member yang melakukan transaksi.
        paket_id (int): Foreign key ke paket yang dibeli.
        jenis (str): Jenis transaksi (beli_paket_guest, beli_paket_member, dll).
        jumlah (int): Nominal transaksi dalam Rupiah.
        menit (int): Durasi dalam menit yang dibeli (jika applicable).
        keterangan (str): Catatan tambahan transaksi.
        dibuat_pada (datetime): Timestamp transaksi dibuat.
        
    Relationships:
        sesi: Relationship ke Sesi terkait.
        member: Relationship ke Member yang bertransaksi.
        paket: Relationship ke Paket yang dibeli.
    """
    
    __tablename__ = "transaksi"
    
    id = db.Column(db.Integer, primary_key=True)
    sesi_id = db.Column(db.Integer, db.ForeignKey("sesi.id"), nullable=True)
    member_id = db.Column(db.Integer, db.ForeignKey("member.id", ondelete="SET NULL"), nullable=True)
    paket_id = db.Column(db.Integer, db.ForeignKey("paket.id"), nullable=True)
    
    # Track operator per shift
    user_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="SET NULL"), nullable=True)
    
    jenis = db.Column(db.String(30), nullable=False)
    jumlah = db.Column(db.Integer, default=0)
    menit = db.Column(db.Integer, default=0)
    keterangan = db.Column(db.String(200))
    dibuat_pada = db.Column(db.DateTime, default=now_local)
    no_nota = db.Column(db.String(50), unique=True, index=True, nullable=True)
    
    # Relationships
    sesi = db.relationship("Sesi", backref="transaksi_list")
    member = db.relationship("Member", backref="transaksi_list")
    paket = db.relationship("Paket", backref="transaksi_list")
    user = db.relationship("User", backref="transaksi_list")

    # Kolom refund
    is_refunded = db.Column(db.Boolean, default=False)
    metode_pembayaran = db.Column(db.String(50), nullable=True)

    
    def to_dict(self):
        """Mengkonversi transaksi ke dictionary untuk API dan laporan.
        
        Returns:
            dict: Dictionary lengkap dengan format display yang rapi.
        """
        return {
            "id": self.id,
            "sesi_id": self.sesi_id,
            "member_id": self.member_id,
            "member_nama": self.member.nama_lengkap or self.member.username if self.member else None,
            "paket_id": self.paket_id,
            "paket_nama": self.paket.nama if self.paket else None,
            "user_id": self.user_id,
            "kasir_nama": self.user.nama_lengkap or self.user.username if self.user else "Kasir Lama",
            "jenis": self.jenis,
            "jenis_display": self._get_jenis_display(),
            "jumlah": self.jumlah,
            "jumlah_display": f"Rp{self.jumlah:,}" if self.jumlah > 0 else "-",
            "menit": self.menit,
            "menit_display": f"{self.menit} menit" if self.menit > 0 else "-",
            "keterangan": self.keterangan,
            "dibuat_pada": format_display(self.dibuat_pada) if self.dibuat_pada else None,
            "metode_pembayaran": self.metode_pembayaran,
        }
    
    def _get_jenis_display(self):
        """Mendapatkan label human-readable untuk jenis transaksi.
        
        Returns:
            str: Label dengan emoji untuk jenis transaksi.
        """
        jenis_map = {
            "beli_paket_guest": "🎮 Guest Beli Paket",
            "beli_paket_member": "👤 Member Beli Paket",
            "tambah_waktu_sesi": "⏰ Member Tambah Waktu",
            "tambah_waktu_guest": "⏱️ Guest Tambah Waktu",
            "tutup_sesi": "🔒 Tutup Sesi",
            "pindah_pc": "🔄 Pindah PC",
            "refund_paket": "↩️ Refund Paket" 
        }
        return jenis_map.get(self.jenis, self.jenis)