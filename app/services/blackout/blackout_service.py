# app/services/blackout_service.py

"""Service untuk penanganan insiden mati lampu (blackout).

Module ini menyediakan mekanisme lengkap untuk mendeteksi,
mengaudit, dan menyelesaikan sesi yang terdampak gangguan listrik.
Termasuk refund saldo member dan resume sesi guest.
"""

from app.models import db, now_local
from app.models import Sesi
from app.models import Transaksi
from app.repositories import SesiRepository
from app.repositories import TransaksiRepository
from app.repositories import MemberRepository
from app.repositories import PCRepository
from app.utils.logger import write_log
from app.services.transaksi.transaksi_service import TransaksiService
from app.config import Config
from datetime import timedelta
import secrets



class BlackoutService:
    """Service untuk penanganan mati lampu (blackout) secara manual oleh kasir."""

    # =========================================================================
    # 1. DETEKSI & MONITORING (DETECTION)
    # =========================================================================
    # Fokus: Mencari sesi yang 'tewas' karena PC tidak kirim sync.

    @staticmethod
    def deteksi(menit_threshold=None):
        """Scan sesi aktif yang macet, tandai sebagai 'suspect' blackout."""
        threshold = menit_threshold or Config.BLACKOUT_THRESHOLD_MINUTES
        batas_waktu = now_local() - timedelta(minutes=threshold)

        sesi_list = SesiRepository.get_aktif_belum_suspect_lama_sync(batas_waktu)

        count = 0
        for sesi in sesi_list:
            # 1. Hitung sisa waktu Dashboard (Real-time jam sekarang)
            sisa_dashboard = sesi.sisa_menit()

            # 2. Hitung sisa waktu Audit (Snapshot saat PC terakhir lapor/mati)
            waktu_referensi = sesi.last_sync or sesi.mulai_pada
            sisa_audit = sesi.hitung_sisa_pada(waktu_referensi)
            
            # 3. Proses DB secara atomik (3-Layer Arch)
            if sesi.tipe == "member" and sesi.member and sisa_dashboard is not None:
                sesi.member.waktu_tersimpan = max(0, sisa_dashboard)
                db.session.add(sesi.member)
            
            sesi.is_blackout_suspect = True
            sesi.is_blackout_resolved = False
            sesi.sisa_menit_saat_mati = max(0, sisa_audit)
            sesi.status = "selesai"
            sesi.selesai_pada = now_local()
            
            db.session.commit()

            label = f"Member:{sesi.member.username}" if sesi.member else f"Guest:{sesi.nama_guest or '?'}"
            write_log("BLACKOUT_DETECT", f"#{sesi.id} | Dash: {sisa_dashboard}m | Audit: {sisa_audit}m", user="kasir")
            count += 1

        write_log("BLACKOUT_DETECT", f"Total terdeteksi: {count} sesi", user="kasir")
        return count

    @staticmethod
    def get_audit_list(selected_date=None):
        """Mengambil daftar sesi suspect blackout untuk halaman audit."""
        return SesiRepository.get_blackout_audit_list(selected_date)

    @staticmethod
    def get_audit_dates():
        """Mengambil daftar tanggal unik yang memiliki insiden blackout."""
        return SesiRepository.get_blackout_audit_dates()


    # =========================================================================
    # 2. RESOLUSI MEMBER (MEMBER REFUND)
    # =========================================================================
    # Fokus: Mengembalikan saldo waktu ke akun member.

    @staticmethod
    def resolve_member(sesi_id, operator="kasir"):
        """Kembalikan sisa saldo waktu saat mati lampu ke akun member."""
        sesi = SesiRepository.get_by_id(sesi_id)
        if not sesi or sesi.tipe != "member" or not sesi.is_blackout_suspect or sesi.is_blackout_resolved:
            raise ValueError("Sesi tidak valid untuk di-resolve")

        member = sesi.member
        saldo_kembali = sesi.sisa_menit_saat_mati or 0

        # Overwrite saldo member sesuai SOP (menimpa, bukan menambah)
        member.waktu_tersimpan = saldo_kembali
        
        # Pastikan sesi ditutup total agar tidak nyangkut
        sesi.status = "selesai"
        sesi.selesai_pada = now_local()
        sesi.is_blackout_resolved = True
        sesi.waktu_resolved = now_local()

        transaksi = Transaksi(
            sesi_id=sesi.id,
            member_id=member.id,
            jenis="blackout_refund",
            keterangan=f"Refund blackout: {saldo_kembali}m ke {member.username}",
            user_id=TransaksiService.get_user_id(operator)
        )
        db.session.add(sesi)
        db.session.add(transaksi)
        db.session.commit()
        write_log("BLACKOUT_RESOLVE_MEMBER", f"Member:{member.username} | Saldo: {saldo_kembali}m", user=operator)
        return {"saldo_kembali": saldo_kembali, "username": member.username}


    # =========================================================================
    # 3. RESOLUSI GUEST (GUEST HANDLING)
    # =========================================================================
    # Fokus: Melanjutkan sesi guest di PC yang sama, PC lain, atau tutup total.

    @staticmethod
    def resolve_guest_sama(sesi_id, operator="kasir"):
        """Lanjutkan sesi guest di PC yang sama (Tutup lama, Buka baru)."""
        sesi = SesiRepository.get_by_id(sesi_id)
        if not sesi or sesi.tipe != "guest" or not sesi.is_blackout_suspect or sesi.is_blackout_resolved:
            raise ValueError("Sesi tidak valid")

        pc = sesi.pc
        sesi_lain = SesiRepository.get_aktif_by_pc(pc.id)
        if sesi_lain and sesi_lain.id != sesi.id:
            raise ValueError(f"PC {pc.kode} sedang digunakan.")

        sisa = sesi.sisa_menit_saat_mati or 0
        sesi.status = "selesai"
        sesi.is_blackout_resolved = True
        sesi.waktu_resolved = now_local()

        sesi_baru = Sesi(
            tipe="guest", nama_guest=sesi.nama_guest, pc_id=pc.id,
            paket_id=sesi.paket_id, durasi_beli_menit=sisa, total_bayar=0,
            status="aktif", token_sesi=secrets.token_hex(32), mulai_pada=now_local(),
            waktu_mulai_sesi=now_local(), last_sync=now_local()
        )
        db.session.add(sesi)
        db.session.add(sesi_baru)
        db.session.commit()
        write_log("BLACKOUT_RESOLVE_GUEST_SAMA", f"{sesi.nama_guest} lanjut di PC:{pc.kode}", user=operator)
        return {"pc": pc.kode, "sisa_menit": sisa, "nama_guest": sesi.nama_guest}

    @staticmethod
    def resolve_guest_lanjut(sesi_id, pc_baru_id, operator="kasir"):
        """Pindahkan sesi guest ke PC lain yang satu grup."""
        sesi = SesiRepository.get_by_id(sesi_id)
        pc_baru = PCRepository.get_by_id(pc_baru_id)
        
        if not sesi or not pc_baru: raise ValueError("Data tidak ditemukan")
        if sesi.pc and pc_baru.grup_id != sesi.pc.grup_id:
            raise ValueError("Hanya bisa pindah ke PC grup yang sama")
        if SesiRepository.get_aktif_by_pc(pc_baru.id):
            raise ValueError(f"PC {pc_baru.kode} sedang digunakan")

        sisa = sesi.sisa_menit_saat_mati or 0
        sesi.status = "selesai"
        sesi.is_blackout_resolved = True
        sesi.waktu_resolved = now_local()

        sesi_baru = Sesi(
            tipe="guest", nama_guest=sesi.nama_guest, pc_id=pc_baru.id,
            paket_id=sesi.paket_id, durasi_beli_menit=sisa, total_bayar=0,
            status="aktif", token_sesi=secrets.token_hex(32), mulai_pada=now_local(),
            waktu_mulai_sesi=now_local(), last_sync=now_local()
        )
        db.session.add(sesi)
        db.session.add(sesi_baru)
        db.session.commit()
        write_log("BLACKOUT_RESOLVE_GUEST_LANJUT", f"{sesi.nama_guest} ke PC:{pc_baru.kode}", user=operator)
        return {"pc_baru": pc_baru.kode, "sisa_menit": sisa, "nama_guest": sesi.nama_guest}

    @staticmethod
    def resolve_tutup_tanpa_kompensasi(sesi_id, operator="kasir"):
        """Tutup catatan blackout tanpa memberikan kompensasi apa pun (Guest/Member)."""
        sesi = SesiRepository.get_by_id(sesi_id)
        if not sesi: raise ValueError("Sesi tidak ditemukan")
        
        # Menandai sesi lama sebagai selesai & resolved
        sesi.status = "selesai"
        sesi.selesai_pada = now_local()
        sesi.is_blackout_resolved = True
        sesi.waktu_resolved = now_local()

        label = f"Member:{sesi.member.username}" if sesi.member else f"Guest:{sesi.nama_guest or '?'}"
        
        transaksi = Transaksi(
            sesi_id=sesi.id, 
            member_id=sesi.member_id, 
            jenis="tutup_sesi", 
            keterangan=f"Blackout resolved: {label} ditutup tanpa kompensasi",
            user_id=TransaksiService.get_user_id(operator)
        )
        db.session.add(sesi)
        db.session.add(transaksi)
        db.session.commit()
        write_log("BLACKOUT_RESOLVE_TUTUP", f"{label} ditutup", user=operator)
        return {"target": label}


    # =========================================================================
    # 4. MAINTENANCE (CLEANUP)
    # =========================================================================
    # Fokus: Membersihkan data lama dan penutupan paksa massal.

    @staticmethod
    def clear_resolved(selected_date, operator="kasir"):
        """Menghapus record blackout yang sudah di-resolve pada tanggal tertentu."""
        deleted = SesiRepository.delete_resolved_blackout(selected_date)
        db.session.commit()
        write_log("BLACKOUT_CLEAR", f"{deleted} record dihapus ({selected_date})", user=operator)
        return deleted

    @staticmethod
    def force_all_and_detect(operator="kasir"):
        """Tombol Panik: Deteksi blackout + Tutup semua yang aktif."""
        count_deteksi = BlackoutService.deteksi()
        count_tutup = SesiRepository.force_close_all_sesi(now_local())
        db.session.commit()
        write_log("FORCE_CLOSE_ALL", f"Tutup:{count_tutup} | Deteksi:{count_deteksi}", user=operator)
        return {"tutup": count_tutup, "deteksi": count_deteksi}