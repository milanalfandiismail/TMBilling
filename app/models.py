# app/models.py - UPDATE dengan timezone WITA

from app import db
from datetime import datetime, timedelta

def now_local():
    """Get current time in WITA - NAIVE"""
    from datetime import datetime
    return datetime.now()  # Naive, pakai waktu sistem (anggap WITA)


# ---------------------------------------------------------------------------
# PAKET
# ---------------------------------------------------------------------------
class Paket(db.Model):
    __tablename__ = "paket"

    id          = db.Column(db.Integer, primary_key=True)
    nama        = db.Column(db.String(100), nullable=False)
    durasi_menit= db.Column(db.Integer, nullable=False)
    harga       = db.Column(db.Integer, nullable=False)
    kadaluarsa_hari = db.Column(db.Integer, default=0)
    aktif       = db.Column(db.Boolean, default=True)
    dibuat_pada = db.Column(db.DateTime, default=now_local)  # GANTI

    def to_dict(self):
        return {
            "id": self.id,
            "nama": self.nama,
            "durasi_menit": self.durasi_menit,
            "harga": self.harga,
            "kadaluarsa_hari": self.kadaluarsa_hari,
            "aktif": self.aktif,
        }

# ---------------------------------------------------------------------------
# SALDO DETAIL - Tracking kadaluarsa per paket
# Member
# ---------------------------------------------------------------------------
class SaldoDetail(db.Model):
    __tablename__ = "saldo_detail"
    
    id = db.Column(db.Integer, primary_key=True)
    member_id = db.Column(db.Integer, db.ForeignKey("member.id"), nullable=False)
    member = db.relationship("Member", backref="saldo_details")
    
    menit = db.Column(db.Integer, nullable=False, default=0)
    menit_awal = db.Column(db.Integer, nullable=False)
    kadaluarsa_pada = db.Column(db.DateTime, nullable=False)
    dibuat_pada = db.Column(db.DateTime, default=now_local)
    transaksi_id = db.Column(db.Integer, db.ForeignKey("transaksi.id"), nullable=True)
    
    def is_valid(self):
        """Cek apakah masih berlaku"""
        now = now_local()
        return self.menit > 0 and now < self.kadaluarsa_pada
    
    def to_dict(self):
        return {
            "id": self.id,
            "menit": self.menit,
            "menit_awal": self.menit_awal,
            "kadaluarsa_pada": self.kadaluarsa_pada.strftime("%Y-%m-%d %H:%M:%S") if self.kadaluarsa_pada else None,
            "dibuat_pada": self.dibuat_pada.strftime("%Y-%m-%d %H:%M:%S") if self.dibuat_pada else None,
        }


class Member(db.Model):
    __tablename__ = "member"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    nama_lengkap = db.Column(db.String(100))
    email = db.Column(db.String(120), unique=True)
    no_hp = db.Column(db.String(20))
    aktif = db.Column(db.Boolean, default=True)
    dibuat_pada = db.Column(db.DateTime, default=now_local)
    
    def set_password(self, password):
        from werkzeug.security import generate_password_hash
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        from werkzeug.security import check_password_hash
        return check_password_hash(self.password_hash, password)
    
    @property
    def total_saldo(self):
        """Total saldo yang masih berlaku"""
        now = now_local()
        total = 0
        for detail in self.saldo_details:
            if detail.menit > 0 and now < detail.kadaluarsa_pada:
                total += detail.menit
        return total
    
    def tambah_saldo(self, menit, kadaluarsa_hari, transaksi_id=None):
        """Tambah saldo dari pembelian paket"""
        kadaluarsa_pada = now_local() + timedelta(days=kadaluarsa_hari)
        
        detail = SaldoDetail(
            member_id=self.id,
            menit=menit,
            menit_awal=menit,
            kadaluarsa_pada=kadaluarsa_pada,
            transaksi_id=transaksi_id
        )
        db.session.add(detail)
        return detail
    
    def kurangi_saldo(self, menit_dibutuhkan):
        """Kurangi saldo FIFO dari yang paling cepat expired"""
        now = now_local()
        sisa = menit_dibutuhkan
        terpakai_total = 0
        
        # Ambil detail yang masih valid
        details = [d for d in self.saldo_details 
                    if d.menit > 0 and now < d.kadaluarsa_pada]
        # Urutkan dari yang paling cepat expired
        details.sort(key=lambda x: x.kadaluarsa_pada)
        
        for detail in details:
            if sisa <= 0:
                break
            
            if detail.menit >= sisa:
                detail.menit -= sisa
                terpakai_total += sisa
                sisa = 0
            else:
                sisa -= detail.menit
                terpakai_total += detail.menit
                detail.menit = 0
        
        if sisa > 0:
            return False, 0
        
        return True, terpakai_total
    
    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "nama_lengkap": self.nama_lengkap,
            "email": self.email,
            "no_hp": self.no_hp,
            "total_saldo": self.total_saldo,
            "saldo_details": [d.to_dict() for d in self.saldo_details if d.menit > 0],
            "aktif": self.aktif,
            "dibuat_pada": self.dibuat_pada.strftime("%Y-%m-%d %H:%M:%S") if self.dibuat_pada else None,
        }

# ---------------------------------------------------------------------------
# PC
# ---------------------------------------------------------------------------
class PC(db.Model):
    __tablename__ = "pc"

    id       = db.Column(db.Integer, primary_key=True)
    kode     = db.Column(db.String(20), unique=True, nullable=False)
    nama     = db.Column(db.String(50))
    ip_address = db.Column(db.String(15), nullable=True)
    grup     = db.Column(db.String(20), default="reguler")
    zona     = db.Column(db.String(50), default="reguler")
    aktif    = db.Column(db.Boolean, default=True)

    @property
    def sesi_aktif(self):
        return Sesi.query.filter_by(pc_id=self.id, status="aktif").first()

    def to_dict(self):
        s = self.sesi_aktif
        return {
            "id": self.id,
            "kode": self.kode,
            "nama": self.nama,
            "ip_address": self.ip_address,
            "grup": self.grup,
            "zona": self.zona,
            "aktif": self.aktif,
            "status": "terpakai" if s else "kosong",
            "sesi_id": s.id if s else None,
        }


# ---------------------------------------------------------------------------
# SESI - FIX: Pakai WITA semua
# ---------------------------------------------------------------------------
class Sesi(db.Model):
    __tablename__ = "sesi"

    id = db.Column(db.Integer, primary_key=True)
    tipe = db.Column(db.String(10), nullable=False)
    member_id = db.Column(db.Integer, db.ForeignKey("member.id"), nullable=True)
    member = db.relationship("Member", backref="sesi_list")
    pc_id = db.Column(db.Integer, db.ForeignKey("pc.id"), nullable=False)
    pc = db.relationship("PC")
    paket_id = db.Column(db.Integer, db.ForeignKey("paket.id"), nullable=True)
    paket = db.relationship("Paket")
    nama_guest = db.Column(db.String(100), nullable=True)
    
    mulai_pada = db.Column(db.DateTime, default=now_local)
    selesai_pada = db.Column(db.DateTime, nullable=True)
    
    menit_dibeli = db.Column(db.Integer, default=0)
    menit_saldo_terpakai = db.Column(db.Integer, default=0)
    status = db.Column(db.String(10), default="aktif")
    total_bayar = db.Column(db.Integer, default=0)

    def menit_terpakai(self):
        """Hitung menit terpakai"""
        try:
            if self.selesai_pada:
                delta = self.selesai_pada - self.mulai_pada
            else:
                delta = now_local() - self.mulai_pada
            return max(0, int(delta.total_seconds() / 60))
        except Exception as e:
            print(f"Error menit_terpakai: {e}")
            return 0

    def sisa_menit(self):
        total = self.menit_dibeli + self.menit_saldo_terpakai
        terpakai = self.menit_terpakai()
        return max(0, total - terpakai)

    def _format_local(self, dt):
        if dt is None:
            return None
        return dt.strftime("%Y-%m-%d %H:%M:%S")

    def to_dict(self):
        member_nama = None
        if self.member:
            member_nama = self.member.nama_lengkap or self.member.username
        elif self.nama_guest:
            member_nama = self.nama_guest
        
        return {
            "id": self.id,
            "tipe": self.tipe,
            "member_id": self.member_id,
            "member_nama": member_nama,
            "nama_guest": self.nama_guest,
            "pc_kode": self.pc.kode if self.pc else None,
            "paket": self.paket.to_dict() if self.paket else None,
            "mulai_pada": self._format_local(self.mulai_pada),
            "selesai_pada": self._format_local(self.selesai_pada),
            "menit_dibeli": self.menit_dibeli,
            "menit_terpakai": self.menit_terpakai(),
            "sisa_menit": self.sisa_menit(),
            "status": self.status,
            "total_bayar": self.total_bayar,
        }


# ---------------------------------------------------------------------------
# TRANSAKSI
# ---------------------------------------------------------------------------
class Transaksi(db.Model):
    __tablename__ = "transaksi"

    id          = db.Column(db.Integer, primary_key=True)
    sesi_id     = db.Column(db.Integer, db.ForeignKey("sesi.id"), nullable=True)
    member_id   = db.Column(db.Integer, db.ForeignKey("member.id"), nullable=True)
    paket_id    = db.Column(db.Integer, db.ForeignKey("paket.id"), nullable=True)

    jenis       = db.Column(db.String(30), nullable=False)
    jumlah      = db.Column(db.Integer, default=0)
    menit       = db.Column(db.Integer, default=0)
    keterangan  = db.Column(db.String(200))
    dibuat_pada = db.Column(db.DateTime, default=now_local)  # GANTI

    def to_dict(self):
        return {
            "id": self.id,
            "sesi_id": self.sesi_id,
            "member_id": self.member_id,
            "jenis": self.jenis,
            "jumlah": self.jumlah,
            "menit": self.menit,
            "keterangan": self.keterangan,
            "dibuat_pada": self.dibuat_pada.strftime("%Y-%m-%d %H:%M:%S") if self.dibuat_pada else None,
        }