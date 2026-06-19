# app/models/user.py

"""Model untuk pengguna sistem (Admin/Kasir).

Module ini mendefinisikan entitas User yang terpisah dari Member.
User adalah staff warnet (admin/kasir) yang mengoperasikan
dashboard web untuk mengelola billing.
"""

from app.models import db, now_local


class User(db.Model):
    """Model untuk pengguna sistem (Admin/Kasir).
    
    Model ini mengelola autentikasi dan autorisasi untuk staff warnet
    yang mengoperasikan aplikasi kasir. Terpisah dari Member yang merupakan
    pelanggan.
    
    Attributes:
        id (int): Primary key user.
        username (str): Username unik untuk login ke dashboard kasir.
        password_hash (str): Hash password yang sudah dienkripsi.
        nama_lengkap (str): Nama lengkap staff/kasir.
        role (str): Peran user ('admin' atau 'kasir').
        aktif (bool): Status akun aktif/nonaktif.
        dibuat_pada (datetime): Timestamp pembuatan akun.
    """
    
    __tablename__ = "user"
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    nama_lengkap = db.Column(db.String(100))
    role = db.Column(db.String(20), default="kasir")
    aktif = db.Column(db.Boolean, default=True)
    dibuat_pada = db.Column(db.DateTime, default=now_local)
    
    def set_password(self, password):
        """Mengenkripsi dan menyimpan password.
        
        Args:
            password (str): Password plaintext yang akan dihash menggunakan
                          Werkzeug generate_password_hash.
        """
        from werkzeug.security import generate_password_hash
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Memverifikasi password terhadap hash yang tersimpan.
        
        Args:
            password (str): Password plaintext untuk diverifikasi.
            
        Returns:
            bool: True jika password cocok, False jika tidak cocok.
        """
        from werkzeug.security import check_password_hash
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        """Mengkonversi data user ke dictionary untuk API response.
        
        Returns:
            dict: Dictionary berisi data user tanpa password hash.
        """
        return {
            "id": self.id,
            "username": self.username,
            "nama_lengkap": self.nama_lengkap,
            "role": self.role,
            "aktif": self.aktif,
        }