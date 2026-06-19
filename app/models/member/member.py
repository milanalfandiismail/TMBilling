# app/models/member.py

"""Model untuk member/pelanggan warnet.

Module ini mendefinisikan entitas Member dengan fitur
manajemen waktu bermain prepaid, autentikasi, kadaluarsa,
dan relasi ke grup serta sesi bermain.
"""

from app.models import db, now_local
from datetime import timedelta


class Member(db.Model):
    """Model untuk member warnet dengan manajemen waktu tersimpan.
    
    Model ini mengelola data member termasuk autentikasi, grup membership,
    dan manajemen waktu bermain yang tersimpan (prepaid).
    
    Attributes:
        id (int): Primary key member.
        username (str): Username unik untuk login.
        password_hash (str): Hash password yang sudah dienkripsi.
        nama_lengkap (str): Nama lengkap member.
        email (str): Alamat email member.
        no_hp (str): Nomor handphone member.
        grup_id (int): Foreign key ke tabel grup.
        aktif (bool): Status aktif/nonaktif member.
        dibuat_pada (datetime): Timestamp pembuatan akun.
        waktu_tersimpan (int): Sisa waktu bermain dalam menit.
        kadaluarsa_pada (datetime): Tanggal kadaluarsa waktu tersimpan.
    """
    
    __tablename__ = "member"
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    nama_lengkap = db.Column(db.String(100))
    email = db.Column(db.String(120))
    no_hp = db.Column(db.String(20))
    
    # Relasi ke Tabel Grup
    grup_id = db.Column(db.Integer, db.ForeignKey("grup.id"), nullable=False)
    grup = db.relationship("Grup", backref="member_list")
    
    aktif = db.Column(db.Boolean, default=True)
    dibuat_pada = db.Column(db.DateTime, default=now_local)
    
    waktu_tersimpan = db.Column(db.Integer, default=0)
    kadaluarsa_pada = db.Column(db.DateTime, nullable=True)
    
    def set_password(self, password):
        """Mengenkripsi dan menyimpan password.
        
        Args:
            password (str): Password plaintext yang akan dihash.
        """
        from werkzeug.security import generate_password_hash
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Memverifikasi password terhadap hash yang tersimpan.
        
        Args:
            password (str): Password plaintext untuk diverifikasi.
            
        Returns:
            bool: True jika password cocok, False jika tidak.
        """
        from werkzeug.security import check_password_hash
        return check_password_hash(self.password_hash, password)
    
    def tambah_waktu(self, menit, kadaluarsa_hari):
        """Tambah waktu dan kadaluarsa (akumulasi, reset jika sebelumnya 0)."""
        
        self.waktu_tersimpan += menit

        if self.waktu_tersimpan - menit == 0:  # sebelumnya 0
            self.kadaluarsa_pada = now_local() + timedelta(days=kadaluarsa_hari)
        else:
            if self.kadaluarsa_pada:
                self.kadaluarsa_pada += timedelta(days=kadaluarsa_hari)
            else:
                self.kadaluarsa_pada = now_local() + timedelta(days=kadaluarsa_hari)

    
    def kurangi_waktu(self, menit=1):
        """Mengurangi waktu tersimpan.
        
        Method ini biasanya dipanggil oleh client C# setiap menit
        selama session aktif.
        
        Args:
            menit (int, optional): Jumlah menit yang akan dikurangi. Defaults to 1.
            
        Returns:
            tuple: (bool, int) - (Status berhasil/tidak, Sisa waktu tersimpan).
        """
        if self.waktu_tersimpan >= menit:
            self.waktu_tersimpan -= menit
            return True, self.waktu_tersimpan
        return False, 0
    
    def cek_kadaluarsa(self):
        """Memeriksa dan membersihkan waktu yang sudah kadaluarsa.
        
        Returns:
            bool: True jika waktu dikadaluarsakan dan direset, False jika masih valid.
        """
        if self.kadaluarsa_pada and now_local() > self.kadaluarsa_pada:
            self.waktu_tersimpan = 0
            self.kadaluarsa_pada = None
            return True
        return False
    
    @property
    def grup_nama(self):
        """Ambil nama grup (string) untuk keperluan JSON."""
        return self.grup.nama if self.grup else "reguler"

    def to_dict(self):
        """Mengkonversi data member ke format dictionary untuk JSON serialization.
        
        Returns:
            dict: Dictionary berisi data member dengan format yang rapi.
                  Mengembalikan nama grup sebagai string, bukan objek.
        """
        waktu_tampil = self.waktu_tersimpan
        
        # Coba ambil sisa waktu real-time jika member sedang bermain (Live Sync)
        try:
            # Mencari sesi 'aktif' terbaru untuk member ini dari backref
            sesi_aktif = next((s for s in self.sesi_list if s.status == 'aktif'), None)
            if sesi_aktif:
                waktu_tampil = sesi_aktif.sisa_menit()
        except:
            pass

        return {
            "id": self.id,
            "username": self.username,
            "nama_lengkap": self.nama_lengkap,
            "email": self.email,
            "no_hp": self.no_hp,
            "grup": self.grup.nama if self.grup else "reguler",
            "grup_warna": self.grup.warna if self.grup else "#888888",
            "waktu_tersimpan": waktu_tampil,
            "kadaluarsa_pada": self.kadaluarsa_pada.strftime("%Y-%m-%d %H:%M:%S") if self.kadaluarsa_pada else None,
            "aktif": self.aktif,
            "dibuat_pada": self.dibuat_pada.strftime("%Y-%m-%d %H:%M:%S") if self.dibuat_pada else None,
        }