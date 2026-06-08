# app/services/member_service.py

"""Service untuk manajemen member/pelanggan warnet.

Module ini menangani business logic CRUD member, transaksi
pembelian paket, manajemen saldo waktu, sistem refund,
dan riwayat pembelian member.
"""

from datetime import timedelta
from app.models.member import Member
from app.models.transaksi import Transaksi
from app.repositories.member_repository import MemberRepository
from app.repositories.sesi_repository import SesiRepository
from app.repositories.grup_repository import GrupRepository
from app.repositories.transaksi_repository import TransaksiRepository
from app.services.transaksi_service import TransaksiService
from app.utils.logger import write_log
from app.models.base import db, now_local

class MemberService:
    """Service untuk business logic member/pelanggan warnet.
    
    Menangani seluruh siklus hidup akun member termasuk CRUD,
    pembelian paket, manajemen saldo waktu, refund, dan riwayat.
    """

    # =========================================================================
    # 1. MANAJEMEN DATA DASAR (CRUD)
    # =========================================================================
    # Fokus: Pengambilan data, pembuatan akun baru, edit profil, dan hapus akun.

    @staticmethod
    def get_all():
        """Mengambil semua data member (diurutkan berdasarkan username)."""
        return MemberRepository.get_all()

    @staticmethod
    def get_paginated_members(search_query=None, page=1, per_page=10, grup_id=None):
        """Mengambil member dengan pagination dan search filter."""
        grup_id_parsed = None
        if grup_id:
            if isinstance(grup_id, int):
                grup_id_parsed = grup_id
            elif str(grup_id).isdigit():
                grup_id_parsed = int(grup_id)
            else:
                from app.repositories.grup_repository import GrupRepository
                grup_obj = GrupRepository.find_by_nama(grup_id)
                if grup_obj:
                    grup_id_parsed = grup_obj.id
        pagination = MemberRepository.get_paginated(search_query, page, per_page, grup_id=grup_id_parsed)
        return {
            "members": [m.to_dict() for m in pagination.items],
            "total": pagination.total,
            "pages": pagination.pages,
            "current_page": pagination.page,
            "per_page": pagination.per_page,
            "has_next": pagination.has_next,
            "has_prev": pagination.has_prev
        }

    @staticmethod
    def get_by_id(member_id):
        """Mengambil satu member berdasarkan ID (404 jika tidak ditemukan)."""
        member = MemberRepository.get_by_id(member_id)
        if member and member.cek_kadaluarsa():
            db.session.commit()
        return member

    @staticmethod
    def get_by_username(username):
        """Mengambil member aktif berdasarkan username."""
        return MemberRepository.get_by_username(username)

    @staticmethod
    def create(data, operator="system"):
        """Buat akun member baru dengan validasi grup & username unik."""
        username = data.get("username", "").strip().lower()
        if not username:
            raise ValueError("Username wajib diisi")
        if MemberRepository.find_by_username(username):
            raise ValueError("Username sudah ada")

        grup_nama = data.get("grup", "reguler")
        grup_obj = GrupRepository.find_by_nama(grup_nama)
        if not grup_obj:
            raise ValueError("Grup member tidak valid")

        member = Member(
            username=username,
            nama_lengkap=data.get("nama_lengkap"),
            email=data.get("email"),
            no_hp=data.get("no_hp"),
            grup_id=grup_obj.id,
            waktu_tersimpan=0
        )
        member.set_password(data.get("password", "123456"))
        db.session.add(member)
        db.session.commit()
        write_log("TAMBAH_MEMBER", f"Member {username} ({grup_nama}) dibuat", user=operator)
        return member

    @staticmethod
    def update(member_id, data, operator="system"):
        """Perbarui profil member (nama, email, grup)."""
        member = MemberRepository.get_by_id(member_id)
        if "grup" in data:
            grup_obj = GrupRepository.find_by_nama(data["grup"])
            if not grup_obj:
                raise ValueError("Grup tidak valid")
            member.grup_id = grup_obj.id

        member.nama_lengkap = data.get("nama_lengkap", member.nama_lengkap)
        member.email = data.get("email", member.email)
        
        # Update password jika disediakan
        if "password" in data and data["password"]:
            member.set_password(data["password"])
        
        db.session.commit()
        write_log("EDIT_MEMBER", f"Data member {member.username} diperbarui", user=operator)
        return member

    @staticmethod
    def delete(member_id, operator="system"):
        """Hapus member secara permanen (Hanya jika tidak sedang main)."""
        member = MemberRepository.get_by_id(member_id)
        if SesiRepository.get_aktif_by_member(member.id):
            raise ValueError("Member sedang bermain, tidak bisa dihapus")
        
        db.session.delete(member)
        db.session.commit()
        write_log("DELETE_MEMBER", f"Member:{member.username} dihapus", user=operator)
        return member


    # =========================================================================
    # 2. TRANSAKSI SALDO & PAKET (BILLING)
    # =========================================================================
    # Fokus: Menambah sisa waktu bermain dan pencatatan transaksi nota TM.

    @staticmethod
    def tambah_waktu(member_id, paket, operator="system", qty=1):
        """Tambah waktu member & suntik Nota Transaksi (TM)."""
        member = MemberRepository.get_by_id(member_id)
        if SesiRepository.get_aktif_by_member(member.id):
            raise ValueError("Member sedang bermain. Gunakan tombol '+Waktu' di dashboard PC.")
        
        if paket.grup_id != member.grup_id:
            raise ValueError(f"Paket grup {paket.grup.nama.upper()}, member grup {member.grup.nama.upper()}")
        
        for _ in range(qty):
            member.tambah_waktu(paket.durasi_menit, paket.kadaluarsa_hari)
        
        # INJECT NOTA TM
        transaksi = Transaksi(
            member_id=member.id, 
            paket_id=paket.id, 
            jenis="beli_paket_member",
            jumlah=paket.harga * qty, 
            menit=paket.durasi_menit * qty,
            keterangan=f"Beli paket '{paket.nama}' x{qty} oleh {member.username}",
            no_nota=TransaksiService.generate_nota(),
            user_id=TransaksiService.get_user_id(operator)
        )
        db.session.add(transaksi)
        db.session.commit()
        
        write_log("TAMBAH_WAKTU", f"Member:{member.username} | +{paket.durasi_menit * qty}m", user=operator)
        write_log("TRANSAKSI", f"Nota:{transaksi.no_nota} | Member:{member.username} | +{paket.durasi_menit * qty}m | Rp {paket.harga * qty}", user=operator)
        return member


    # =========================================================================
    # 3. SISTEM REFUND (RECOVERY)
    # =========================================================================
    # Fokus: Mengurangi saldo jika terjadi kesalahan beli paket dan update status transaksi.

    @staticmethod
    def refund_paket(member_id, transaksi_id, operator="system"):
        """Batalkan pembelian paket & potong saldo waktu member."""
        member = MemberRepository.get_by_id(member_id)
        if SesiRepository.get_aktif_by_member(member.id):
            raise ValueError("Member sedang bermain. Tutup sesi dulu.")

        transaksi = TransaksiRepository.get_by_id(transaksi_id)
        if not transaksi or transaksi.member_id != member.id or transaksi.is_refunded:
            raise ValueError("Transaksi tidak valid atau sudah direfund")

        durasi = transaksi.menit or (transaksi.paket.durasi_menit if transaksi.paket else 0)
        
        if member.waktu_tersimpan < durasi:
            raise ValueError(f"Paket ini ({durasi}m) sudah terpakai/habis. Sisa saldo saat ini hanya {member.waktu_tersimpan}m.")
            
        kadaluarsa_hari = transaksi.paket.kadaluarsa_hari if transaksi.paket else 0
        
        sebelum = member.waktu_tersimpan
        waktu_baru = max(0, sebelum - durasi)

        member.waktu_tersimpan = waktu_baru
        transaksi.is_refunded = True

        # Re-kalkulasi Kadaluarsa
        qty = 1
        if transaksi.paket and transaksi.paket.durasi_menit:
            qty = max(1, durasi // transaksi.paket.durasi_menit)
            
        kadaluarsa_hari_total = kadaluarsa_hari * qty
        if kadaluarsa_hari_total > 0 and member.kadaluarsa_pada:
            kadaluarsa_baru = member.kadaluarsa_pada - timedelta(days=kadaluarsa_hari_total)
            member.kadaluarsa_pada = kadaluarsa_baru if kadaluarsa_baru > now_local() else None

        # INJECT NOTA REFUND TM
        transaksi_refund = Transaksi(
            member_id=member.id,
            paket_id=transaksi.paket_id,
            jenis="refund_paket",
            jumlah=-(transaksi.jumlah),
            menit=-(durasi),
            keterangan=f"Refund paket '{transaksi.paket.nama if transaksi.paket else '?'}'",
            no_nota=TransaksiService.generate_nota(),
            user_id=TransaksiService.get_user_id(operator)
        )
        db.session.add(transaksi_refund)
        db.session.commit()

        write_log("REFUND_PAKET", f"Member:{member.username} | Saldo: {sebelum}m → {waktu_baru}m", user=operator)
        write_log("TRANSAKSI", f"REFUND | Nota:{transaksi_refund.no_nota} | Rp {transaksi_refund.jumlah}", user=operator)
        
        return {
            "username": member.username,
            "saldo_sebelum": sebelum,
            "saldo_sesudah": waktu_baru,
            "durasi_dikurangi": durasi
        }


    # =========================================================================
    # 4. HISTORI & REPORTING (LOGGING)
    # =========================================================================
    # Fokus: Pengambilan riwayat untuk ditampilkan di profil member atau audit kasir.

    @staticmethod
    def get_riwayat_paket(member_id):
        """Mengambil riwayat pembelian paket member untuk audit kasir.
        
        Hanya menampilkan paket yang belum habis (masih berkontribusi ke saldo).
        """
        member = MemberRepository.get_by_id(member_id)
        if not member:
            return []
            
        # Update status kadaluarsa sebelum hitung saldo untuk refund
        if member.cek_kadaluarsa():
            db.session.commit()
            
        transaksi_list = TransaksiRepository.get_riwayat_paket_member(member_id)
        result = []
        
        saldo_sisa = member.waktu_tersimpan
        
        # Loop dari yang terbaru ke terlama
        for t in transaksi_list:
            if saldo_sisa <= 0:
                break
                
            durasi = t.menit or (t.paket.durasi_menit if t.paket else 0)
            
            result.append({
                "id": t.id,
                "nama": t.paket.nama if t.paket else "Paket Dihapus",
                "durasi_menit": durasi,
                "harga": t.jumlah,
                "dibuat_pada": t.dibuat_pada.strftime("%Y-%m-%d %H:%M") if t.dibuat_pada else "-",
                "jenis": t.jenis,
            })
            
            saldo_sisa -= durasi
            
        return result