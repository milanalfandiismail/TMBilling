# app/services/client_service.py

"""Service untuk komunikasi dengan client C#.

Modul ini menangani request dari aplikasi client yang terinstall
di PC warnet, termasuk identifikasi PC, cek status sesi, dan
update last activity.
"""

from app.models import db, now_local
from app.repositories import PCRepository
from app.repositories import SesiRepository
from app.services.sesi.sesi_service import SesiService
from app.services.settings.settings_service import SettingsService
from app.utils.logger import write_log


# Antrean instruksi perintah real-time per PC (Key: pc_id, Value: command_type)
PENDING_COMMANDS = {}


class ClientService:
    """Service untuk endpoint client C#."""

    @staticmethod
    def queue_command(pc_id, command_type):
        """Menambahkan perintah ke antrean PC."""
        PENDING_COMMANDS[pc_id] = command_type

    @staticmethod
    def _normalize_mac(mac):
        """Hapus semua separator dan jadikan uppercase untuk komparasi."""
        if not mac: return ""
        return mac.replace(":", "").replace("-", "").replace(" ", "").upper().strip()

    @staticmethod
    def _format_mac(mac):
        """Ubah AABBCCDDEEFF jadi AA:BB:CC:DD:EE:FF."""
        clean = ClientService._normalize_mac(mac)
        if len(clean) != 12: return clean # Biarin apa adanya kalo aneh
        return ":".join(clean[i:i+2] for i in range(0, 12, 2))

    @staticmethod
    def identify(ip_address, mac_address, role=None):
        """Identifikasi PC pertama kali saat client startup."""
        write_log("IDENTIFY_START", f"PC coba kenalan: IP={ip_address}, MAC={mac_address}")
        
        # 1. Cari berdasarkan IP (identitas utama)
        pc = PCRepository.find_by_ip(ip_address)
        
        if not pc:
            write_log("IDENTIFY_FAIL", f"IP {ip_address} tidak ada di database")
            raise ValueError(f"IP {ip_address} tidak dikenal server")

        norm_client_mac = ClientService._normalize_mac(mac_address)

        # 2. Kondisi: Jika MAC di DB masih kosong -> Auto-register
        if not pc.mac_address:
            formatted_mac = ClientService._format_mac(mac_address)
            pc.mac_address = formatted_mac
            db.session.commit()
            write_log("IDENTIFY_AUTO_REG", f"MAC PC {pc.kode} otomatis didaftarkan: {formatted_mac}")
        
        # 3. Kondisi: Jika MAC di DB sudah ada -> Harus COCOK (IP AND MAC)
        else:
            norm_db_mac = ClientService._normalize_mac(pc.mac_address)
            if norm_client_mac != norm_db_mac:
                write_log("IDENTIFY_REJECTED", f"Akses ditolak! IP {ip_address} sudah terikat MAC {norm_db_mac}, tapi client kirim {norm_client_mac}")
                raise ValueError("PC tidak cocok (Security Mismatch)")

        write_log("IDENTIFY_SUCCESS", f"PC {pc.kode} berhasil diidentifikasi")
        return {
            "valid": True,
            "pc_kode": pc.kode,
            "grup": pc.grup.nama if pc.grup else "reguler"
        }

    @staticmethod
    def get_status(ip_address, mac_address, role=None):
        """Polling rutin dari client: Validasi IP & MAC jika sudah terikat."""
        try:
            pc = PCRepository.get_by_ip(ip_address)
            if not pc:
                raise ValueError("IP PC tidak terdaftar")
            
            # Kondisi A: MAC di DB masih kosong -> Langsung isi otomatis (Auto-register pasif)
            if not pc.mac_address:
                formatted_mac = ClientService._format_mac(mac_address)
                pc.mac_address = formatted_mac
                db.session.commit()
                write_log("STATUS_AUTO_REG", f"MAC PC {pc.kode} otomatis diisi via Polling: {formatted_mac}")

            # Kondisi B: MAC di DB sudah ada -> WAJIB cocok (Security Check)
            else:
                norm_client_mac = ClientService._normalize_mac(mac_address)
                norm_db_mac = ClientService._normalize_mac(pc.mac_address)
                if norm_client_mac != norm_db_mac:
                    write_log("STATUS_REJECTED", f"Polling ditolak: {ip_address} mismatch MAC. DB:{norm_db_mac} Client:{norm_client_mac}")
                    raise ValueError("Identitas PC tidak valid (MAC Mismatch)")

            # Update Last Activity
            pc.last_activity = now_local()
            db.session.commit()

            # B. Cek Sesi Aktif
            sesi = SesiRepository.get_aktif_by_pc(pc.id)
            
            # 🔥 STATUS ADMIN AUTHORITY
            # Jika klien ngaku admin tapi di DB sudah dimatikan (oleh kasir),
            # maka kita paksa klien untuk LOCK (kembali ke mode kiosk).
            # PENGECUALIAN: role "emergency" selalu diizinkan tanpa soal is_admin_mode
            res = None

            # 🔥 STATUS ADMIN AUTHORITY
            # Jika klien ngaku admin tapi di DB sudah dimatikan (oleh kasir),
            # maka kita paksa klien untuk LOCK (kembali ke mode kiosk).
            # PENGECUALIAN: role "emergency" selalu diizinkan tanpa soal is_admin_mode
            if role == "admin" and not pc.is_admin_mode:
                write_log("REMOTE_LOGOUT", f"PC {pc.kode} dipaksa logout admin oleh server")
                res = {
                    "status": "kosong",
                    "pc_kode": pc.kode,
                    "command": "lock"
                }

            else:
                # Sebaliknya, jika klien bukan admin tapi di DB tercatat admin, 
                # maka sync status DB agar dashboard kasir akurat.
                if role != "admin" and pc.is_admin_mode:
                    pc.is_admin_mode = False
                    db.session.commit()

                # Cek apakah PC sedang dalam mode Admin (Maintenance)
                # Jika admin mode aktif di DB, maka PC TIDAK BOLEH dianggap kosong.
                if pc.is_admin_mode:
                    res = {
                        "status": "admin",
                        "pc_kode": pc.kode,
                        "shutdown_timer": 0
                    }
                
                # Jika PC Kosong (Tidak ada Sesi & Bukan Admin) -> Kirim Timer Auto-Shutdown
                elif not sesi:
                    timer_str = SettingsService.get("auto_shutdown_timer_seconds", "180")
                    try:
                        shutdown_timer = int(timer_str)
                    except ValueError:
                        shutdown_timer = 180
                    shutdown_timer = max(30, min(600, shutdown_timer))
                    res = {
                        "status": "kosong",
                        "pc_kode": pc.kode,
                        "shutdown_timer": shutdown_timer
                    }

                else:
                    # C. Sesi Ada -> Update Sync & Hitung Sisa Waktu
                    try:
                        sesi.last_sync = now_local()
                        db.session.commit()
                    except:
                        write_log("SYNC_ERROR", f"Gagal update last_sync PC {pc.kode}")
                        pass

                    try:
                        sisa = SesiService.sync_waktu_member(sesi)
                    except Exception as inner_e:
                        write_log("CLIENT_STATUS_ERROR", f"Error sync PC {pc.kode}: {inner_e}")
                        sisa = 0

                    # D. Jika Waktu Habis -> Selesaikan Sesi
                    if sisa <= 0:
                        sesi.status = "selesai"
                        sesi.selesai_pada = now_local()
                        db.session.commit()
                        
                        timer_str = SettingsService.get("auto_shutdown_timer_seconds", "180")
                        try:
                            shutdown_timer = int(timer_str)
                        except ValueError:
                            shutdown_timer = 180
                        shutdown_timer = max(30, min(600, shutdown_timer))
                        res = {
                            "status": "kosong",
                            "message": "Waktu habis",
                            "pc_kode": pc.kode,
                            "shutdown_timer": shutdown_timer
                        }
                    else:
                        # E. Return Status Aktif Normal
                        if role == "admin":
                            status_text = "admin"
                        else:
                            status_text = "aktif"

                        res = {
                            "status": status_text,
                            "sisa_waktu": sisa,
                            "nama": sesi.member.username if sesi.member else (sesi.nama_guest or "Guest"),
                            "grup": pc.grup.nama if pc.grup else "reguler",
                            "pc_kode": pc.kode,
                            "shutdown_timer": 0 
                        }

            if res and "command" not in res:
                cmd = PENDING_COMMANDS.pop(pc.id, None)
                if cmd:
                    res["command"] = cmd

            return res


        except Exception as e:
            write_log("CLIENT_STATUS_CRASH", f"Error fatal polling {ip_address}: {e}")
            return {"status": "error", "message": "Server error"}


    # =========================================================================
    # 2. EMERGENCY LOGIN (OFFLINE-FIRST ADMIN)
    # =========================================================================
    # Fokus: Login admin dari PC client tanpa harus validasi user DB.
    # Emergency login selalu diterima server, dan mengaktifkan is_admin_mode.

    @staticmethod
    def emergency_login(ip_address, mac_address):
        """Login emergency dari PC client (bisa offline/online)."""
        pc = PCRepository.get_by_ip(ip_address)
        if not pc:
            raise ValueError("IP PC tidak terdaftar")

        # Auto-fill MAC jika kosong
        if not pc.mac_address:
            formatted_mac = ClientService._format_mac(mac_address)
            pc.mac_address = formatted_mac
        else:
            norm_client_mac = ClientService._normalize_mac(mac_address)
            norm_db_mac = ClientService._normalize_mac(pc.mac_address)
            if norm_client_mac != norm_db_mac:
                raise ValueError("Identitas PC tidak valid (MAC Mismatch)")

        # Aktifkan admin mode di DB biar polling diterima
        pc.is_admin_mode = True
        db.session.commit()

        write_log("EMERGENCY_LOGIN", f"PC {pc.kode} emergency login activated")
        return {"success": True, "message": "Emergency admin mode activated"}


    # =========================================================================
    # 3. LOGIN KHUSUS (ADMIN LOGIN)
    # =========================================================================
    # Fokus: Menangani login admin langsung dari PC client untuk maintenance.

    @staticmethod
    def admin_login(ip_address, mac_address, username, password):
        """Login admin dari PC client (Force login bypass)."""
        from app.repositories import UserRepository
        import secrets
        
        from app.repositories import UserRepository
        import secrets
        
        pc = PCRepository.get_by_ip(ip_address)
        if not pc:
            raise ValueError("IP PC tidak terdaftar")
        
        # Auto-fill jika kosong saat admin login
        if not pc.mac_address:
            formatted_mac = ClientService._format_mac(mac_address)
            pc.mac_address = formatted_mac
            db.session.commit()
        # Jika sudah ada, wajib cocok
        else:
            norm_client_mac = ClientService._normalize_mac(mac_address)
            norm_db_mac = ClientService._normalize_mac(pc.mac_address)
            if norm_client_mac != norm_db_mac:
                raise ValueError("Identitas PC tidak valid (MAC Mismatch)")
        
        user = UserRepository.get_by_username(username)
        if not user or not user.check_password(password) or user.role != "admin":
            raise ValueError("Invalid admin credentials")
        
        # Tutup sesi member/guest yang mungkin sedang aktif
        existing = SesiRepository.get_aktif_by_pc(pc.id)
        if existing:
            existing.status = "selesai"
            existing.selesai_pada = now_local()
            db.session.commit()
        
        # Buat sesi khusus admin
        token = secrets.token_hex(32)
        pc.is_admin_mode = True # Aktifkan mode admin di DB
        SesiService.buka_admin(pc.id, token)
        
        db.session.commit()
        return {"success": True, "token_sesi": token}


    # =========================================================================
    # 3. KONTROL SESI DARI CLIENT (TERMINATION)
    # =========================================================================
    # Fokus: Menutup sesi atas permintaan dari aplikasi client.

    @staticmethod
    def tutup_sesi(ip_address, mac_address):
        """Request penutupan sesi yang dipicu dari tombol 'Logout' di Client."""
        try:
            pc = PCRepository.get_by_ip(ip_address)
            if not pc:
                raise ValueError("IP PC tidak terdaftar")

            # Auto-fill jika kosong saat sesi ditutup
            if not pc.mac_address:
                formatted_mac = ClientService._format_mac(mac_address)
                pc.mac_address = formatted_mac
                db.session.commit()
            # Jika sudah ada, wajib cocok
            else:
                norm_client_mac = ClientService._normalize_mac(mac_address)
                norm_db_mac = ClientService._normalize_mac(pc.mac_address)
                if norm_client_mac != norm_db_mac:
                    raise ValueError("MAC address mismatch")

            sesi = SesiRepository.get_aktif_by_pc(pc.id)
            if sesi:
                SesiService.tutup_sesi(sesi.id, operator="client")

            pc.last_activity = now_local()
            db.session.commit()

            return {"success": True, "message": "Sesi ditutup"}
        except Exception as e:
            write_log("CLIENT_TUTUP_ERROR", f"Error tutup {ip_address}: {e}")
            return {"success": False, "message": "Gagal menutup sesi"}