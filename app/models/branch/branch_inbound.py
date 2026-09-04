# app/models/branch/branch_inbound.py
"""Model data untuk mencatat koneksi cabang masuk (Inbound Connections)."""

from app.models import db, now_local


class BranchInbound(db.Model):
    """Model data untuk melacak server cabang luar yang mengontrol server ini.
    
    Attributes:
        id (int): Primary key.
        nama (str): Nama warnet cabang pengontrol.
        url (str): URL server pengontrol (jika ada).
        mac_address (str): MAC address hardware pengontrol.
        ip_address (str): Alamat IP pengirim.
        operator_terakhir (str): Username operator/kasir pengirim terakhir.
        total_request (int): Akumulasi jumlah request yang diterima.
        status (str): Status akses ('aktif' atau 'diblokir').
        pertama_terhubung (datetime): Waktu pertama kali koneksi diterima.
        terakhir_aktif (datetime): Waktu terakhir kali koneksi diterima.
    """

    __tablename__ = "cabang_inbound"

    id = db.Column(db.Integer, primary_key=True)
    nama = db.Column(db.String(100), nullable=False)
    url = db.Column(db.String(255), nullable=True)
    mac_address = db.Column(db.String(50), nullable=True)
    ip_address = db.Column(db.String(100), nullable=True)
    operator_terakhir = db.Column(db.String(100), nullable=True)
    total_request = db.Column(db.Integer, default=1, nullable=False)
    status = db.Column(db.String(20), default="aktif", nullable=False)
    pertama_terhubung = db.Column(db.DateTime, default=now_local, nullable=False)
    terakhir_aktif = db.Column(db.DateTime, default=now_local, nullable=False)

    def to_dict(self):
        """Konversi data cabang inbound ke dictionary."""
        return {
            "id": self.id,
            "nama": self.nama,
            "url": self.url,
            "mac_address": self.mac_address,
            "ip_address": self.ip_address,
            "operator_terakhir": self.operator_terakhir,
            "total_request": self.total_request,
            "status": self.status,
            "pertama_terhubung": self.pertama_terhubung.isoformat() if self.pertama_terhubung else None,
            "terakhir_aktif": self.terakhir_aktif.isoformat() if self.terakhir_aktif else None,
        }
