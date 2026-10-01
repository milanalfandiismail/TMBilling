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

        # B. Autentikasi Member atau Kasir (Benefit Bermain)
        member = MemberRepository.get_by_username(username)
        user_kasir = None
        if member:
            if not member.check_password(password):
                raise ValueError("Username atau password salah")
        else:
            from app.models.user.user import User
            user_staff = User.query.filter_by(username=username).first()
            if user_staff and user_staff.check_password(password):
                if not user_staff.aktif:
                    raise ValueError("Akun kasir nonaktif")
                user_kasir = user_staff
            else:
                raise ValueError("Username atau password salah")

        # C. Validasi PC
        pc = PCRepository.get_by_ip_and_mac(ip_address, mac_address)
        if not pc:
            raise ValueError("PC tidak terdaftar")

        if SesiRepository.get_aktif_by_pc(pc.id):
            raise ValueError(f"PC {pc.kode} sedang dipakai")

        # D. Alur Sesi Khusus Kasir (Benefit Bermain Staff)
        if user_kasir:
            sesi_aktif = Sesi.query.filter_by(user_id=user_kasir.id, status="aktif").first()
            if sesi_aktif:
                pc_lain = sesi_aktif.pc
                pc_kode_lain = pc_lain.kode if pc_lain else "lain"
                raise ValueError(f"Kasir sedang bermain di PC {pc_kode_lain}. Logout dulu!")

            user_kasir.cek_dan_reset_kuota_bulanan()
            if (user_kasir.sisa_kuota_menit or 0) <= 0:
                raise ValueError("Kuota bermain kasir bulan ini sudah habis. Hubungi Admin!")

            sesi = Sesi(
                tipe="kasir",
                user_id=user_kasir.id,
                pc_id=pc.id,
                status="aktif",
                token_sesi=secrets.token_hex(32),
                waktu_mulai_sesi=now_local(),
                waktu_tersimpan_awal=user_kasir.sisa_kuota_menit
            )
            pc.is_admin_mode = False
            db.session.add(pc)
            db.session.add(sesi)
            db.session.commit()

            write_log("LOGIN_KASIR_BENEFIT", f"Kasir {username} login di PC {pc.kode} | Sisa: {user_kasir.sisa_kuota_menit}m")

            return {
                "success": True,
                "waktu_tersimpan": user_kasir.sisa_kuota_menit,
                "nama": f"[Kasir] {user_kasir.nama_lengkap or user_kasir.username}",
                "grup": pc.grup.nama if pc.grup else "Kasir",
                "pc_kode": pc.kode,
                "token_sesi": sesi.token_sesi,
                "sesi_id": sesi.id,
                "tipe": "kasir"
            }

        # E. Cek Double Login Member
        sesi_aktif = SesiRepository.get_aktif_by_member(member.id)
        if sesi_aktif:
            pc_lain = sesi_aktif.pc
            raise ValueError(f"Member sedang aktif di PC {pc_lain.kode}. Logout dulu!")

        # F. Validasi Grup Matching Member
        if member.grup != pc.grup:
            raise ValueError(f"Member {member.grup.nama.upper()} tidak bisa di PC {pc.grup.nama.upper()}")

        # G. Cek Saldo & Masa Aktif Member
        member.cek_kadaluarsa()
        if member.waktu_tersimpan <= 0:
            raise ValueError("Waktu habis, silakan beli paket ke kasir")

        # H. Generate Sesi & Token Member
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
            "sesi_id": sesi.id,
            "tipe": "member"
        }


    # =========================================================================
    # 2. MEMBER / KASIR LOGOUT PROCESS
    # =========================================================================
    # Fokus: Validasi token dan penutupan sesi aktif secara aman.

    @staticmethod
    def logout(ip_address, mac_address, token_sesi=None):
        """Logout member atau kasir dan menutup sesi aktif di database."""
        pc = PCRepository.get_by_ip_and_mac(ip_address, mac_address)
        if not pc:
            raise ValueError("PC tidak terdaftar")

        sesi = SesiRepository.get_aktif_by_pc(pc.id)
        if not sesi:
            raise ValueError("Tidak ada sesi aktif")
            
        if token_sesi and sesi.token_sesi != token_sesi:
            raise ValueError("Token salah")

        # Sinkronisasi sisa saldo / kuota
        sisa = sesi.sisa_menit()
        if sesi.tipe == "member" and sesi.member:
            sesi.member.waktu_tersimpan = sisa
        elif sesi.tipe == "kasir" and sesi.user:
            sesi.user.sisa_kuota_menit = sisa

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