# app/models/branch/branch.py
"""Model data untuk koneksi cabang warnet (Multi-Cabang)."""

from app.models import db, now_local


class Branch(db.Model):
    """Model data untuk entitas cabang warnet terhubung.
    
    Attributes:
        id (int): Primary key.
        nama (str): Nama cabang (misal 'TM-Esports Belida').
        url (str): Base URL cabang (contoh 'https://tm2billing.milannn.my.id').
        api_key (str): Kunci otentikasi rahasia cabang target.
        aktif (bool): Status apakah cabang aktif di switcher.
        urutan (int): Urutan prioritas dropdown.
        status_online (bool): Hasil health check status terakhir.
        latensi_ms (int): Latensi ping dalam milidetik.
        terakhir_dicek (datetime): Waktu terakhir kali koneksi dicek.
        dibuat_pada (datetime): Timestamp pendaftaran cabang.
    """

    __tablename__ = "cabang"

    id = db.Column(db.Integer, primary_key=True)
    nama = db.Column(db.String(100), nullable=False)
    url = db.Column(db.String(255), nullable=False)
    api_key = db.Column(db.String(255), nullable=False)
    aktif = db.Column(db.Boolean, default=True, nullable=False)
    urutan = db.Column(db.Integer, default=0, nullable=False)
    status_online = db.Column(db.Boolean, default=False, nullable=False)
    latensi_ms = db.Column(db.Integer, nullable=True)
    terakhir_dicek = db.Column(db.DateTime, nullable=True)
    dibuat_pada = db.Column(db.DateTime, default=now_local, nullable=False)

    def to_dict(self, include_key=False):
        """Konversi data cabang ke dictionary."""
        data = {
            "id": self.id,
            "nama": self.nama,
            "url": self.url,
            "aktif": self.aktif,
            "urutan": self.urutan,
            "status_online": self.status_online,
            "latensi_ms": self.latensi_ms,
            "terakhir_dicek": self.terakhir_dicek.isoformat() if self.terakhir_dicek else None,
            "dibuat_pada": self.dibuat_pada.isoformat() if self.dibuat_pada else None,
        }
        if include_key:
            data["api_key"] = self.api_key
        return data
