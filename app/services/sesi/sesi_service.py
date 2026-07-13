# app/services/sesi_service.py

"""Service untuk manajemen sesi bermain.

Modul ini menangani business logic inti sesi: buka, tutup,
pindah PC, tambah waktu, dan sinkronisasi waktu real-time.
"""

import secrets
from datetime import timedelta
from app.models import Sesi
from app.models import Transaksi
from app.models import db, now_local
from app.repositories import SesiRepository
from app.repositories import PCRepository
from app.repositories import MemberRepository
from app.repositories import PaketRepository
from app.repositories import TransaksiRepository
from app.services.transaksi.transaksi_service import TransaksiService
from app.utils.logger import write_log

from app.config import Config



class SesiService:
    """Service untuk business logic Sesi bermain."""

    # =========================================================================
    # 1. PEMBUKAAN SESI (OPEN SESSION)
    # =========================================================================
    # Fokus: Validasi PC, Member/Guest, dan Paket sebelum sesi dimulai.

    @staticmethod
    def buka_guest(pc_kode, paket_id, nama_guest="Guest", operator="system", metode_pembayaran="Tunai"):
        """Buka sesi baru untuk guest dan generate nota pembelian."""
        pc = PCRepository.get_by_kode(pc_kode)
        if not pc: raise ValueError("PC tidak ditemukan")
        if SesiRepository.get_aktif_by_pc(pc.id): raise ValueError("PC sedang dipakai")

        paket = PaketRepository.get_by_id(paket_id)
        if not paket or not paket.aktif: raise ValueError("Paket tidak valid")
        
        if paket.grup_id != pc.grup_id:
            raise ValueError(f"PC {pc.grup.nama.upper()} dilarang pakai paket {paket.grup.nama.upper()}")

        sesi = Sesi(
            tipe="guest", nama_guest=nama_guest, pc_id=pc.id, paket_id=paket.id,
            durasi_beli_menit=paket.durasi_menit, total_bayar=paket.harga,
            status="aktif", token_sesi=secrets.token_hex(32)
        )
        transaksi = Transaksi(
            paket_id=paket.id, jenis="beli_paket_guest", jumlah=paket.harga,
            menit=paket.durasi_menit, keterangan=f"Guest '{nama_guest}' di {pc_kode}",
            no_nota=TransaksiService.generate_nota(),
            user_id=TransaksiService.get_user_id(operator),
            metode_pembayaran=metode_pembayaran
        )
        
        # Simpan secara atomik di Service Layer
        db.session.add(sesi)
        db.session.flush() # Ambil ID sesi untuk transaksi
        transaksi.sesi_id = sesi.id
        db.session.add(transaksi)
        db.session.commit()

        write_log("BUKA_GUEST", f"PC:{pc_kode} | Guest:{nama_guest} | {paket.durasi_menit}m", user=operator)
        write_log("TRANSAKSI", f"Nota:{transaksi.no_nota} | Beli:{paket.nama} | Rp {paket.harga}", user=operator)
        return sesi

    @staticmethod
    def buka_member(pc_kode, username, operator="system"):
        """Buka sesi baru untuk member berdasarkan saldo tersimpan."""
        pc = PCRepository.get_by_kode(pc_kode)
        if not pc or SesiRepository.get_aktif_by_pc(pc.id):
            raise ValueError("PC tidak tersedia")

        member = MemberRepository.get_by_username(username)
        if not member: raise ValueError("Member tidak ditemukan")

        if member.grup_id != pc.grup_id:
            raise ValueError(f"Member {member.grup.nama.upper()} dilarang di PC {pc.grup.nama.upper()}")

        member.cek_kadaluarsa()
        if member.waktu_tersimpan <= 0: raise ValueError("Waktu habis")

        sesi = Sesi(
            tipe="member", member_id=member.id, pc_id=pc.id, status="aktif",
            token_sesi=secrets.token_hex(32), waktu_mulai_sesi=now_local(),
            waktu_tersimpan_awal=member.waktu_tersimpan
        )
        db.session.add(sesi)
        db.session.commit()
        write_log("BUKA_MEMBER", f"PC:{pc.kode} | Member:{member.username}", user=operator)
        return sesi

    @staticmethod
    def buka_admin(pc_id, token_sesi):
        """Membuka sesi khusus admin untuk maintenance PC."""
        sesi_baru = Sesi(
            tipe="admin",
            pc_id=pc_id,
            status="aktif",
            is_admin=True,
            token_sesi=token_sesi,
            waktu_mulai_sesi=now_local()
        )
        db.session.add(sesi_baru)
        db.session.commit()
        return sesi_baru


    # =========================================================================
    # 2. MANAJEMEN WAKTU & UPDATE (TIME MANAGEMENT)
    # =========================================================================
    # Fokus: Menambah durasi sesi dan sinkronisasi saldo waktu member.

    @staticmethod
    def tambah_waktu_sesi(sesi_id, paket, operator="system", qty=1, metode_pembayaran="Tunai"):
        """Tambah durasi pada sesi berjalan (Guest/Member) + Suntik Nota TM."""
        sesi = SesiRepository.get_aktif_by_id(sesi_id)
        if not sesi: raise ValueError("Sesi tidak aktif")

        if paket.grup_id != sesi.pc.grup_id:
            raise ValueError(f"Paket zona {paket.grup.nama.upper()} tidak cocok dengan PC!")
        
        if sesi.tipe == "member" and sesi.member:
            for _ in range(qty):
                sesi.member.tambah_waktu(paket.durasi_menit, paket.kadaluarsa_hari)
            sesi.waktu_tersimpan_awal += (paket.durasi_menit * qty)
            
            transaksi = Transaksi(
                member_id=sesi.member.id, paket_id=paket.id, sesi_id=sesi.id,
                jenis="tambah_waktu_sesi", jumlah=paket.harga * qty, menit=paket.durasi_menit * qty,
                keterangan=f"Tambah waktu member {sesi.member.username} x{qty}",
                no_nota=TransaksiService.generate_nota(),
                user_id=TransaksiService.get_user_id(operator),
                metode_pembayaran=metode_pembayaran
            )
            db.session.add(transaksi)
            db.session.commit()
            write_log("TAMBAH_WAKTU", f"Member:{sesi.member.username} | +{paket.durasi_menit * qty}m", user=operator)
            return {"tipe": "member", "waktu_tersimpan": sesi.member.waktu_tersimpan}

        elif sesi.tipe == "guest":
            sesi.durasi_beli_menit += paket.durasi_menit * qty
            sesi.total_bayar += paket.harga * qty
            
            transaksi = Transaksi(
                sesi_id=sesi.id, paket_id=paket.id, jenis="tambah_waktu_guest",
                jumlah=paket.harga * qty, menit=paket.durasi_menit * qty,
                keterangan=f"Tambah waktu guest {sesi.nama_guest} x{qty}",
                no_nota=TransaksiService.generate_nota(),
                user_id=TransaksiService.get_user_id(operator),
                metode_pembayaran=metode_pembayaran
            )
            db.session.add(transaksi)
            db.session.commit()
            write_log("TAMBAH_WAKTU", f"Guest:{sesi.nama_guest} | +{paket.durasi_menit * qty}m", user=operator)
            return {"tipe": "guest", "sisa_menit": sesi.sisa_menit()}

    @staticmethod
    def sync_waktu_member(sesi):
        """Sinkronisasi saldo waktu di database Member dengan sisa waktu sesi."""
        sisa = sesi.sisa_menit()
        if sesi.tipe == "member" and sesi.member:
            if sesi.member.waktu_tersimpan != sisa:
                sesi.member.waktu_tersimpan = sisa
                db.session.commit()
        return sisa


    # =========================================================================
    # 3. PENYELESAIAN & PERPINDAHAN (TERMINATION & TRANSFER)
    # =========================================================================
    # Fokus: Menutup sesi (dengan rollback protection) dan pindah unit PC.

    @staticmethod
    def tutup_sesi(sesi_id, operator="system"):
        """Tutup sesi bermain dengan proteksi Atomic Transaction (Commit/Rollback)."""
        sesi = SesiRepository.get_aktif_by_id(sesi_id)
        if not sesi: raise ValueError("Sesi tidak ditemukan")

        try:
            # 1. Hitung sisa waktu final (Live calculation)
            sisa_final = sesi.sisa_menit()

            # 2. Update Member (Jika ada)
            if sesi.tipe == "member" and sesi.member:
                sesi.member.waktu_tersimpan = sisa_final
                db.session.add(sesi.member)
            
            # 3. Update status sesi
            sesi.status = "selesai"
            sesi.selesai_pada = now_local()
            
            # Reset mode admin jika yang ditutup adalah sesi admin
            if sesi.tipe == "admin" and sesi.pc:
                sesi.pc.is_admin_mode = False
            
            # 4. Buat objek transaksi penutupan
            transaksi = Transaksi(
                sesi_id=sesi.id, member_id=sesi.member_id,
                jenis="tutup_sesi", keterangan=f"Sesi {sesi.tipe} ditutup oleh {operator}",
                user_id=TransaksiService.get_user_id(operator)
            )
            db.session.add(transaksi)
            
            # 5. Commit semua dalam satu transaksi DB (3-Layered Arch)
            db.session.commit()

            write_log("TUTUP_SESI", f"{sesi.tipe.upper()} | PC:{sesi.pc.kode} | Main:{sesi.menit_terpakai()}m")
            return sesi

        except Exception as e:
            db.session.rollback() # Batalkan semua jika gagal
            write_log("TUTUP_SESI_ERROR", f"Gagal menutup sesi {sesi_id}: {str(e)}")
            raise e

    @staticmethod
    def pindah_pc(sesi_id, pc_kode_baru, operator="system"):
        """Pindahkan sesi aktif ke PC lain dalam grup yang sama."""
        sesi = SesiRepository.get_aktif_by_id(sesi_id)
        pc_baru = PCRepository.get_by_kode(pc_kode_baru)
        
        if not sesi or not pc_baru: raise ValueError("Data tidak valid")
        if sesi.pc.grup_id != pc_baru.grup_id: raise ValueError("Beda grup zona!")
        if SesiRepository.get_aktif_by_pc(pc_baru.id): raise ValueError("PC tujuan sedang dipakai")

        pc_lama_kode = sesi.pc.kode
        sisa_waktu = sesi.sisa_menit()

        # Update sisa terakhir ke member
        if sesi.member:
            sesi.member.waktu_tersimpan = sisa_waktu
        
        # Tutup sesi lama secara manual (tanpa repo commit)
        if sesi.member_id:
            all_sesi = SesiRepository.get_all_aktif_by_member(sesi.member_id)
            for s in all_sesi:
                s.status = "selesai"
                s.selesai_pada = now_local()
        else:
            sesi.status = "selesai"
            sesi.selesai_pada = now_local()

        # Buat sesi baru di unit tujuan
        sesi_baru = Sesi(
            tipe=sesi.tipe, member_id=sesi.member_id, pc_id=pc_baru.id,
            paket_id=sesi.paket_id, nama_guest=sesi.nama_guest,
            token_sesi=secrets.token_hex(32), durasi_beli_menit=sisa_waktu,
            total_bayar=sesi.total_bayar, status="aktif",
            waktu_mulai_sesi=now_local(), waktu_tersimpan_awal=sisa_waktu
        )
        db.session.add(sesi_baru)
        db.session.flush() # Ambil ID sesi baru

        # Log Transaksi Pindah
        transaksi = Transaksi(
            sesi_id=sesi_baru.id, member_id=sesi.member_id,
            jenis="pindah_pc", keterangan=f"Pindah dari {pc_lama_kode} ke {pc_baru.kode}",
            user_id=TransaksiService.get_user_id(operator)
        )
        db.session.add(transaksi)
        db.session.commit()

        write_log("PINDAH_PC", f"{pc_lama_kode} -> {pc_baru.kode} | Sisa:{sisa_waktu}m", user=operator)
        return {"pc_lama": pc_lama_kode, "pc_baru": pc_baru.kode, "sisa_waktu": sisa_waktu}


    # =========================================================================
    # 4. PEMELIHARAAN (MAINTENANCE)
    # =========================================================================
    # Fokus: Pembersihan sesi kedaluwarsa dan utilitas informasi.

    @staticmethod
    def cleanup_expired():
        """Auto-cleanup: Tutup sesi yang waktunya habis (Tanpa proteksi blackout otomatis)."""
        sesi_aktif = SesiRepository.get_all_aktif()
        count = 0
        now = now_local()
        for sesi in sesi_aktif:
            # Lewati sesi jika PC terdeteksi offline (tidak sync > 120 detik) agar tidak ditutup normal
            if sesi.last_sync and (now - sesi.last_sync).total_seconds() > 120:
                continue
                
            if sesi.sisa_menit() <= 0:
                sesi.status = "selesai"
                sesi.selesai_pada = now_local()
                count += 1
        if count > 0: db.session.commit()
        return count

    @staticmethod
    def cleanup_inactive_admin_sessions():
        """Reset status is_admin_mode di DB jika PC sudah tidak aktif (Heartbeat mati)."""
        now = now_local()
        # Cari semua PC yang sedang dalam mode admin
        admin_pcs = PCRepository.get_all_admin_mode()
        
        count = 0
        for pc in admin_pcs:
            # Jika last_activity sudah lewat 30 detik (sebelumnya 10), matikan mode adminnya
            # Dikasih buffer lebih lama biar nggak gampang force-lock kalau ada lag.
            if not pc.last_activity or (now - pc.last_activity).total_seconds() > 30:
                pc.is_admin_mode = False
                count += 1
                
        if count > 0:
            db.session.commit()
            write_log("CLEANUP", f"Reset {count} PC dari mode Admin (Idle timeout)")



    @staticmethod
    def get_detail(sesi_id):
        """Mengambil data ringkas sesi untuk kebutuhan internal (ID, tipe, grup)."""
        sesi = SesiRepository.get_by_id(sesi_id)
        return {
            "id": sesi.id, "tipe": sesi.tipe,
            "grup": sesi.pc.grup.nama if sesi.pc and sesi.pc.grup else "reguler",
            "pc_kode": sesi.pc.kode if sesi.pc else None,
            "member_id": sesi.member_id,
            "member_nama": sesi.member.nama_lengkap if sesi.member else None,
            "username": sesi.member.username if sesi.member else None,
            "guest_nama": sesi.nama_guest,
            "sisa_waktu": sesi.sisa_menit() if hasattr(sesi, 'sisa_menit') else 0
        }