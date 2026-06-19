# app/models/sesi.py

"""Model untuk sesi bermain di warnet.

Module ini mendefinisikan entitas Sesi yang merepresentasikan
setiap sesi penggunaan PC, baik oleh guest, member, maupun admin.
Menyimpan data waktu, pembayaran, dan status blackout recovery.
"""

from app.models import db, now_local


class Sesi(db.Model):
    """Model untuk sesi bermain aktif di PC warnet.
    
    Model ini merepresentasikan setiap sesi penggunaan PC, baik
    oleh guest (tamu) maupun member (pelanggan terdaftar). Menyimpan
    informasi lengkap termasuk waktu, pembayaran, dan status blackout.
    
    Attributes:
        id (int): Primary key sesi.
        tipe (str): Jenis sesi ('guest', 'member', atau 'admin').
        member_id (int): Foreign key ke member (nullable untuk guest).
        pc_id (int): Foreign key ke PC yang digunakan.
        paket_id (int): Foreign key ke paket yang dibeli.
        nama_guest (str): Nama tamu (hanya untuk tipe 'guest').
        token_sesi (str): Token unik 64-karakter untuk autentikasi client.
        mulai_pada (datetime): Waktu mulai sesi.
        selesai_pada (datetime): Waktu selesai sesi (None jika masih aktif).
        durasi_beli_menit (int): Total durasi yang dibeli (untuk guest).
        total_bayar (int): Total nominal pembayaran Rupiah.
        status (str): Status sesi ('aktif' atau 'selesai').
        is_admin (bool): Flag sesi admin (maintenance PC).
        waktu_mulai_sesi (datetime): Timestamp awal perhitungan waktu.
        waktu_tersimpan_awal (int): Saldo awal member saat sesi dimulai.
        last_sync (datetime): Timestamp sinkronisasi terakhir dari client.
        menit_pause_total (int): Total menit pause akibat blackout.
        sisa_menit_saat_mati (int): Snapshot sisa menit saat blackout terjadi.
        is_blackout_suspect (bool): Flag suspect kehilangan sesi akibat blackout.
        is_blackout_resolved (bool): Flag resolusi blackout oleh kasir.
        waktu_resolved (datetime): Timestamp saat blackout di-resolve.
        
    Relationships:
        member: Relasi ke Member yang memiliki sesi.
        pc: Relasi ke PC yang digunakan.
        paket: Relasi ke Paket yang dibeli.
    """
    
    __tablename__ = "sesi"
    
    id = db.Column(db.Integer, primary_key=True)
    tipe = db.Column(db.String(10), nullable=False)

    # Relasi ke Member
    member_id = db.Column(db.Integer, db.ForeignKey("member.id"), nullable=True)
    member = db.relationship("Member", backref="sesi_list")
    
    # Relasi ke PC
    pc_id = db.Column(db.Integer, db.ForeignKey("pc.id", ondelete="SET NULL"), nullable=True)
    pc = db.relationship('PC', back_populates='sesi_list')    
    
    # Relasi ke Paket
    paket_id = db.Column(db.Integer, db.ForeignKey("paket.id"), nullable=True)
    paket = db.relationship("Paket")
    
    nama_guest = db.Column(db.String(100), nullable=True)
    token_sesi = db.Column(db.String(64), unique=True, nullable=True)
    
    mulai_pada = db.Column(db.DateTime, default=now_local)
    selesai_pada = db.Column(db.DateTime, nullable=True)
    durasi_beli_menit = db.Column(db.Integer, default=0)
    total_bayar = db.Column(db.Integer, default=0)
    status = db.Column(db.String(10), default="aktif")
    

    # Data untuk menampilkan admin di dashboard
    is_admin = db.Column(db.Boolean, default=False)


    # Logika sinkronisasi waktu
    waktu_mulai_sesi = db.Column(db.DateTime, nullable=True)
    waktu_tersimpan_awal = db.Column(db.Integer, default=0)
    last_sync = db.Column(db.DateTime, nullable=True)
    menit_pause_total = db.Column(db.Integer, default=0)

    # Kolom untuk Screenshot Audit Mati Lampu
    sisa_menit_saat_mati = db.Column(db.Integer, default=0)
    is_blackout_suspect = db.Column(db.Boolean, default=False)
    is_blackout_resolved = db.Column(db.Boolean, default=False)
    waktu_resolved = db.Column(db.DateTime, nullable=True)

    def hitung_sisa_pada(self, waktu_acuan):
        """Menghitung sisa menit pada titik waktu tertentu.
        
        Method ini digunakan untuk kalkulasi waktu saat audit blackout,
        merekonstruksi berapa sisa waktu yang seharusnya ada pada saat tertentu.
        
        Args:
            waktu_acuan (datetime): Timestamp acuan untuk perhitungan.
            
        Returns:
            int: Sisa menit pada waktu acuan, minimal 0.
            
        Note:
            - Untuk member: menggunakan waktu_mulai_sesi dan waktu_tersimpan_awal
            - Untuk guest: menggunakan mulai_pada dan durasi_beli_menit
            - Memperhitungkan menit_pause_total
        """
        if not waktu_acuan:
            return 0
            
        # Tentukan jam mulai berdasarkan tipe
        waktu_awal = self.waktu_mulai_sesi if self.tipe == "member" else self.mulai_pada
        
        # Tentukan modal waktu awal
        total_awal = self.waktu_tersimpan_awal if self.tipe == "member" else self.durasi_beli_menit
        
        # Hitung menit yang sudah berjalan sampai waktu_acuan
        delta = waktu_acuan - waktu_awal
        menit_terpakai_raw = int(delta.total_seconds() / 60)
        
        # Sisa = (Modal + Pause) - Terpakai
        pause = self.menit_pause_total or 0
        sisa = (total_awal + pause) - menit_terpakai_raw
        
        return max(0, sisa)

    def menit_terpakai(self):
        """Menghitung total menit yang sudah terpakai efektif.
        
        Mengurangi total waktu berjalan dengan total pause blackout.
        
        Returns:
            int: Menit terpakai yang sudah dikurangi pause.
        """
        pause = self.menit_pause_total or 0
        if self.tipe == "guest":
            if self.selesai_pada:
                delta = self.selesai_pada - self.mulai_pada
            else:
                delta = now_local() - self.mulai_pada
            raw = max(0, int(delta.total_seconds() / 60))
            return max(0, raw - pause)
        else:
            if self.waktu_mulai_sesi:
                delta = now_local() - self.waktu_mulai_sesi
                raw = max(0, int(delta.total_seconds() / 60))
                return max(0, raw - pause)
            return 0
    
    def sisa_menit(self):
        """Menghitung sisa menit secara real-time.
        
        Method utama yang dipanggil UI untuk menampilkan sisa waktu.
        Memperhitungkan blackout pause dan tipe sesi (guest/member).
        
        Returns:
            int: Sisa menit yang tersedia, minimal 0.
        """
        pause = self.menit_pause_total or 0
        if self.tipe == "guest":
            return max(0, self.durasi_beli_menit - self.menit_terpakai())
        else:
            if self.waktu_mulai_sesi and self.waktu_tersimpan_awal > 0:
                delta = now_local() - self.waktu_mulai_sesi
                menit_terpakai = max(0, int(delta.total_seconds() / 60) - pause)
                return max(0, self.waktu_tersimpan_awal - menit_terpakai)
            return self.member.waktu_tersimpan if self.member else 0
    
    def to_dict(self):
        """Mengkonversi data sesi ke dictionary untuk API response.
        
        Returns:
            dict: Dictionary lengkap berisi informasi sesi, member, PC, dan status waktu.
        """
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
            "grup": self.pc.grup.nama if self.pc and self.pc.grup else "reguler",
            "paket": self.paket.to_dict() if self.paket else None,
            "mulai_pada": self.mulai_pada.strftime("%Y-%m-%d %H:%M:%S") if self.mulai_pada else None,
            "selesai_pada": self.selesai_pada.strftime("%Y-%m-%d %H:%M:%S") if self.selesai_pada else None,
            "sisa_menit": self.sisa_menit(),
            "status": self.status,
            "waktu_mulai_sesi": self.waktu_mulai_sesi.strftime("%Y-%m-%d %H:%M:%S") if self.waktu_mulai_sesi else None,
            "waktu_tersimpan_awal": self.waktu_tersimpan_awal,
            "menit_pause_total": self.menit_pause_total,
            "is_admin": self.is_admin,
            "last_sync": self.last_sync.strftime("%Y-%m-%d %H:%M:%S") if self.last_sync else None,
        }
    
    def to_dict_audit(self):
        """Mengkonversi data sesi ke format audit blackout.
        
        Method khusus untuk halaman audit mati lampu dengan informasi
        yang relevan untuk kasir saat menangani insiden blackout.
        
        Returns:
            dict: Dictionary ringkas untuk audit blackout.
        """
        return {
            "id": self.id,
            "pc_kode": self.pc.kode if self.pc else "??",
            "username": self.member.username if self.member else self.nama_guest or "Guest",
            "tipe": self.tipe,
            "grup": self.pc.grup.nama if self.pc and self.pc.grup else "reguler",
            "jam_mati": self.last_sync.strftime("%H:%M:%S") if self.last_sync else self.mulai_pada.strftime("%H:%M:%S"),
            "sisa_waktu_mati": self.sisa_menit_saat_mati or 0,
            "is_blackout_resolved": self.is_blackout_resolved
        }