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


class CommandQueueDict(dict):
    """Dict yang mendukung antrean perintah FIFO per PC dan tetap 100% kompatibel dengan akses dict lama."""
    def push_cmd(self, pc_id, cmd):
        q = super().get(pc_id)
        if q is None:
            super().__setitem__(pc_id, [cmd])
        elif isinstance(q, list):
            q.append(cmd)
        else:
            super().__setitem__(pc_id, [q, cmd])

    def pop_cmd(self, pc_id, default=None):
        q = super().get(pc_id)
        if q is None:
            return default
        if isinstance(q, list):
            cmd = q.pop(0) if len(q) > 0 else default
            if not q:
                super().pop(pc_id, None)
            return cmd
        else:
            return super().pop(pc_id, default)

    def pop(self, pc_id, default=None):
        return self.pop_cmd(pc_id, default)

    def get(self, pc_id, default=None):
        q = super().get(pc_id, default)
        if isinstance(q, list):
            return q[-1] if len(q) > 0 else default
        return q

    def __getitem__(self, pc_id):
        q = super().__getitem__(pc_id)
        if isinstance(q, list):
            return q[-1] if len(q) > 0 else None
        return q


# Antrean instruksi perintah real-time per PC (Key: pc_id, Value: list of command_types)
PENDING_COMMANDS = CommandQueueDict()
PENDING_FAST_COMMANDS = CommandQueueDict()
PENDING_VNC_COMMANDS = PENDING_FAST_COMMANDS


class ClientService:
    """Service untuk endpoint client C# / Rust."""

    @staticmethod
    def queue_command(pc_id, command_type):
        """Menambahkan perintah ke antrean polling reguler PC (GUI)."""
        PENDING_COMMANDS.push_cmd(pc_id, command_type)

    @staticmethod
    def queue_fast_command(pc_id, command_type):
        """Menambahkan perintah cepat on-demand ke antrean PC (Monitor Agent / Remote Control)."""
        PENDING_FAST_COMMANDS.push_cmd(pc_id, command_type)

    @staticmethod
    def pop_command(pc_id):
        """Mengambil perintah reguler FIFO dari antrean."""
        return PENDING_COMMANDS.pop_cmd(pc_id)

    @staticmethod
    def pop_fast_command(pc_id):
        """Mengambil perintah cepat FIFO dari antrean."""
        return PENDING_FAST_COMMANDS.pop_cmd(pc_id)

    @staticmethod
    def queue_vnc_command(pc_id, command_type):
        """Alias kompatibilitas untuk queue_fast_command."""
        ClientService.queue_fast_command(pc_id, command_type)

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
        polling_interval = SettingsService.get_client_polling_interval()
        return {
            "valid": True,
            "pc_kode": pc.kode,
            "grup": pc.grup.nama if pc.grup else "reguler",
            "polling_interval": polling_interval
        }

    @staticmethod
    def get_status(ip_address, mac_address, role=None):
        """Polling rutin dari client: Validasi IP & MAC jika sudah terikat."""
        try:
            pc = PCRepository.get_by_ip(ip_address)

            # ❌ IP tidak ditemukan → coba fallback ke MAC (lebih stabil, tidak berubah)
            if not pc:
                pc = PCRepository.find_by_mac(mac_address)

                if pc:
                    # ✅ Ketemu via MAC! IP client berubah (DHCP renew).
                    # ⚠️ IP di DB TETAP — jangan diupdate otomatis. Security dulu.
                    write_log("CLIENT_STATUS_MAC_FALLBACK",
                              f"PC {pc.kode} IP={ip_address} via MAC fallback (DB IP={pc.ip_address})")
                else:
                    # ❌ MAC juga ga ketemu → PC beneran ga terdaftar
                    write_log("CLIENT_STATUS_UNKNOWN",
                              f"PC tidak dikenal: IP={ip_address} MAC={mac_address}")
                    return {
                        "status": "kosong",
                        "message": "PC tidak dikenal",
                        "shutdown_timer": 180
                    }

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
            
            # 🔥 STATUS ADMIN & SYSTEM AUTHORITY
            # Jika klien ngaku admin/emergency/system tapi di DB sudah dimatikan (oleh kasir),
            # maka kita paksa klien untuk LOCK (kembali ke mode kiosk).
            if role in ["admin", "emergency", "system"] and not pc.is_admin_mode:
                write_log("REMOTE_LOGOUT", f"PC {pc.kode} dipaksa logout admin/system ({role}) oleh server")
                res = {
                    "status": "kosong",
                    "pc_kode": pc.kode,
                    "command": "lock"
                }

            else:
                # Sebaliknya, jika klien bukan admin/emergency/system tapi di DB tercatat admin, 
                # maka sync status DB agar dashboard kasir akurat.
                if role not in ["admin", "emergency", "system"] and pc.is_admin_mode:
                    pc.is_admin_mode = False
                    db.session.commit()

                # Cek apakah PC sedang dalam mode Admin (Maintenance) atau System
                # Jika admin mode aktif di DB, maka PC TIDAK BOLEH dianggap kosong.
                if pc.is_admin_mode:
                    is_sys_session = (sesi and (sesi.nama_guest or "").strip().upper() == "SYSTEM")
                    res = {
                        "status": "system" if is_sys_session else "admin",
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
                        sesi.is_afk = False
                        sesi.afk_pin = None
                        sesi.afk_sejak = None
                        if sesi.tipe == "member" and sesi.member:
                            sesi.member.waktu_tersimpan = 0
                            db.session.add(sesi.member)
                        elif sesi.tipe == "kasir" and sesi.user:
                            sesi.user.sisa_kuota_menit = 0
                            db.session.add(sesi.user)
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
                            "is_afk": sesi.is_afk or False,
                            "shutdown_timer": 0 
                        }

            if res:
                res["polling_interval"] = SettingsService.get_client_polling_interval()
                if "command" not in res:
                    cmd = ClientService.pop_command(pc.id)
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
    def emergency_login(ip_address, mac_address, username="SYSTEM", socket_ip=None):
        """Login emergency dari PC client (bisa offline/online) dengan Strict Socket IP binding."""
        # Validasi Strict Socket IP: IP koneksi fisik wajib sama dengan IP target
        if socket_ip and socket_ip not in ("127.0.0.1", "::1", "localhost"):
            if socket_ip != ip_address:
                write_log("SECURITY_ALERT", f"Emergency login ditolak: IP fisik {socket_ip} tidak cocok dengan target {ip_address}")
                raise PermissionError("Akses emergency login ditolak: IP soket fisik tidak cocok dengan IP PC terdaftar")

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

        # Tutup sesi member/guest yang mungkin sedang aktif
        existing = SesiRepository.get_aktif_by_pc(pc.id)
        if existing:
            sisa_final = existing.sisa_menit()
            if existing.tipe == "member" and existing.member:
                existing.member.waktu_tersimpan = sisa_final
                db.session.add(existing.member)
            elif existing.tipe == "kasir" and existing.user:
                existing.user.sisa_kuota_menit = sisa_final
                db.session.add(existing.user)
            existing.status = "selesai"
            existing.selesai_pada = now_local()
            existing.is_afk = False
            existing.afk_pin = None
            existing.afk_sejak = None
            db.session.commit()

        # Buat sesi khusus emergency admin
        import secrets
        token = secrets.token_hex(32)
        pc.is_admin_mode = True
        pc.last_activity = now_local()
        SesiService.buka_admin(pc.id, token, admin_nama="SYSTEM")
        db.session.commit()

        # Catat username yang memicu emergency login untuk audit
        triggered_by = username if username else "SYSTEM"
        write_log("EMERGENCY_LOGIN", f"PC {pc.kode} ({ip_address}) emergency login activated by '{triggered_by}'")
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
            sisa_final = existing.sisa_menit()
            if existing.tipe == "member" and existing.member:
                existing.member.waktu_tersimpan = sisa_final
                db.session.add(existing.member)
            elif existing.tipe == "kasir" and existing.user:
                existing.user.sisa_kuota_menit = sisa_final
                db.session.add(existing.user)
            existing.status = "selesai"
            existing.selesai_pada = now_local()
            existing.is_afk = False
            existing.afk_pin = None
            existing.afk_sejak = None
            db.session.commit()
        
        # Buat sesi khusus admin
        token = secrets.token_hex(32)
        pc.is_admin_mode = True # Aktifkan mode admin di DB
        pc.last_activity = now_local()
        display_name = user.nama_lengkap or user.username
        SesiService.buka_admin(pc.id, token, admin_nama=display_name)
        
        db.session.commit()
        write_log(
            "CLIENT_ADMIN_LOGIN",
            f"Admin {username} login langsung di PC {pc.kode}",
            user=username,
            detail_json={"pc_kode": pc.kode, "ip_address": ip_address, "mac_address": mac_address, "admin_user": username}
        )
        return {
            "success": True,
            "token_sesi": token,
            "user": {
                "id": user.id,
                "username": user.username,
                "nama_lengkap": display_name,
                "role": user.role
            }
        }



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


    # =========================================================================
    # 4. KUNCI MEJA AFK / ISTIRAHAT SEMENTARA
    # =========================================================================
    # Fokus: Mengunci layar PC sementara dan membuka kunci dengan PIN/Password.

    @staticmethod
    def afk_lock(ip_address, mac_address, pin=None):
        """Mengunci PC untuk istirahat (AFK)."""
        pc = PCRepository.get_by_ip(ip_address)
        if not pc and mac_address:
            pc = PCRepository.find_by_mac(mac_address)
        if not pc:
            raise ValueError("IP PC tidak terdaftar")

        sesi = SesiRepository.get_aktif_by_pc(pc.id)
        if not sesi:
            raise ValueError("Tidak ada sesi aktif di PC ini")

        if sesi.is_afk:
            return {"success": True, "message": "PC sudah dalam status AFK"}

        hashed_pin = None
        if sesi.tipe == "guest":
            if not pin or len(str(pin).strip()) == 0:
                raise ValueError("PIN / Password tidak boleh kosong untuk tamu")
            from werkzeug.security import generate_password_hash
            hashed_pin = generate_password_hash(str(pin).strip())

        sesi.is_afk = True
        sesi.afk_pin = hashed_pin
        sesi.afk_sejak = now_local()
        pc.last_activity = now_local()
        db.session.commit()

        user_label = sesi.member.username if sesi.member else (sesi.nama_guest or "Guest")
        write_log("CLIENT_AFK_LOCKED", f"PC {pc.kode} dikunci AFK oleh {user_label}", detail_json={"pc_kode": pc.kode, "user": user_label, "tipe": sesi.tipe})
        return {"success": True, "message": "PC berhasil dikunci untuk AFK"}

    @staticmethod
    def afk_unlock(ip_address, mac_address, credential):
        """Membuka kunci PC yang sedang AFK."""
        pc = PCRepository.get_by_ip(ip_address)
        if not pc and mac_address:
            pc = PCRepository.find_by_mac(mac_address)
        if not pc:
            raise ValueError("IP PC tidak terdaftar")

        sesi = SesiRepository.get_aktif_by_pc(pc.id)
        if not sesi:
            raise ValueError("Tidak ada sesi aktif di PC ini")

        if not sesi.is_afk:
            return {"success": True, "message": "PC tidak dalam status AFK"}

        if not credential:
            raise ValueError("Password akun atau PIN wajib diisi")

        valid = False
        if sesi.tipe == "member" and sesi.member:
            if sesi.afk_pin:
                from werkzeug.security import check_password_hash
                valid = check_password_hash(sesi.afk_pin, str(credential).strip()) or sesi.member.check_password(str(credential))
            else:
                valid = sesi.member.check_password(str(credential))
        elif sesi.afk_pin:
            from werkzeug.security import check_password_hash
            valid = check_password_hash(sesi.afk_pin, str(credential).strip())
        elif sesi.tipe == "guest" and not sesi.afk_pin:
            # PERBAIKAN BUG: Dilarang bypass karakter acak
            valid = False

        if not valid:
            user_label = sesi.member.username if sesi.member else (sesi.nama_guest or "Guest")
            write_log("CLIENT_AFK_UNLOCK_FAILED", f"Gagal buka kunci AFK di PC {pc.kode} (Kredensial salah)", detail_json={"pc_kode": pc.kode, "user": user_label})
            raise PermissionError("Password akun atau PIN salah")

        sesi.is_afk = False
        sesi.afk_pin = None
        sesi.afk_sejak = None
        pc.last_activity = now_local()
        db.session.commit()

        user_label = sesi.member.username if sesi.member else (sesi.nama_guest or "Guest")
        write_log("CLIENT_AFK_UNLOCKED", f"PC {pc.kode} berhasil dibuka kunci AFK oleh {user_label}", detail_json={"pc_kode": pc.kode, "user": user_label})
        return {"success": True, "message": "Kunci meja berhasil dibuka"}