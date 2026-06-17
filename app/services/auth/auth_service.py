# app/services/auth_service.py

"""Service untuk autentikasi client C#.

Modul ini menangani login/logout member langsung dari aplikasi
client C# yang terinstall di PC warnet, termasuk validasi
MAC address dan grup matching.
"""

import secrets
from app.models import db, now_local
from app.models import Sesi
from app.repositories import MemberRepository
from app.repositories import PCRepository
from app.repositories import SesiRepository
from app.utils.logger import write_log


class AuthService:
    """Service untuk autentikasi member di client C#."""

    # =========================================================================
    # 1. MEMBER LOGIN PROCESS
    # =========================================================================
    # Fokus: Validasi kredensial, pengecekan PC, matching grup, dan pembuatan sesi.

    @staticmethod
    def login(username: str, password: str, ip_address: str, mac_address: str):
        """Login member dari PC client dengan validasi berlapis."""
        # A. Validasi Input Dasar
        if not username or not password:
            raise ValueError("Username dan password wajib diisi")
        if not ip_address or not mac_address:
            raise ValueError("IP dan MAC address wajib diisi")

        # B. Autentikasi Member
        member = MemberRepository.get_by_username(username)
        if not member or not member.check_password(password):
            raise ValueError("Username atau password salah")

        # C. Cek Double Login (Mencegah satu akun di dua PC)
        sesi_aktif = SesiRepository.get_aktif_by_member(member.id)
        if sesi_aktif:
            pc_lain = sesi_aktif.pc
            raise ValueError(f"Member sedang aktif di PC {pc_lain.kode}. Logout dulu!")

        # D. Validasi PC & Grup Matching
        pc = PCRepository.get_by_ip_and_mac(ip_address, mac_address)
        if not pc:
            raise ValueError("PC tidak terdaftar")

        if member.grup != pc.grup:
            raise ValueError(f"Member {member.grup.nama.upper()} tidak bisa di PC {pc.grup.nama.upper()}")

        if SesiRepository.get_aktif_by_pc(pc.id):
            raise ValueError(f"PC {pc.kode} sedang dipakai")

        # E. Cek Saldo & Masa Aktif
        member.cek_kadaluarsa()
        if member.waktu_tersimpan <= 0:
            raise ValueError("Waktu habis, silakan beli paket ke kasir")

        # F. Generate Sesi & Token
        sesi = Sesi(
            tipe="member",
            member_id=member.id,
            pc_id=pc.id,
            status="aktif",
            token_sesi=secrets.token_hex(32),
            waktu_mulai_sesi=now_local(),
            waktu_tersimpan_awal=member.waktu_tersimpan
        )
        
        # Matikan mode admin jika sebelumnya aktif
        pc.is_admin_mode = False
        db.session.add(pc)
        
        db.session.add(sesi)
        db.session.commit()

        write_log("LOGIN_MEMBER", f"{username} login di PC {pc.kode} | Sisa: {member.waktu_tersimpan}m")
        
        return {
            "success": True,
            "waktu_tersimpan": member.waktu_tersimpan,
            "nama": member.nama_lengkap or member.username,
            "grup": member.grup_nama,
            "pc_kode": pc.kode,
            "token_sesi": sesi.token_sesi,
            "sesi_id": sesi.id
        }


    # =========================================================================
    # 2. MEMBER LOGOUT PROCESS
    # =========================================================================
    # Fokus: Validasi token dan penutupan sesi aktif secara aman.

    @staticmethod
    def logout(ip_address, mac_address, token_sesi=None):
        """Logout member dan menutup sesi aktif di database."""
        pc = PCRepository.get_by_ip_and_mac(ip_address, mac_address)
        if not pc:
            raise ValueError("PC tidak terdaftar")

        sesi = SesiRepository.get_aktif_by_pc(pc.id)
        if not sesi:
            raise ValueError("Tidak ada sesi aktif")
            
        if token_sesi and sesi.token_sesi != token_sesi:
            raise ValueError("Token salah")

        SesiRepository.close_session(sesi)
        db.session.commit()
        return {"success": True}


    # =========================================================================
    # 3. PC STATUS CHECK
    # =========================================================================
    # Fokus: Memberikan info ke client apakah PC siap digunakan atau tidak.

    @staticmethod
    def get_status(ip_address, mac_address):
        """Cek status ketersediaan PC client."""
        pc = PCRepository.get_by_ip_and_mac(ip_address, mac_address)
        if not pc:
            raise ValueError("PC tidak terdaftar")

        sesi_aktif = SesiRepository.get_aktif_by_pc(pc.id)
        return {
            "pc_kode": pc.kode,
            "grup": pc.grup.nama if pc.grup else "reguler",
            "status": "dipakai" if sesi_aktif else "kosong",
            "sesi_id": sesi_aktif.id if sesi_aktif else None
        }