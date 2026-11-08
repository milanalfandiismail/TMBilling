# app/services/client_service.py

"""Service untuk komunikasi dengan client C#.

Modul ini menangani request dari aplikasi client yang terinstall
di PC warnet, termasuk identifikasi PC, cek status sesi, dan
update last activity.
"""

import hmac

from app.models import db, now_local
from app.repositories import PCRepository
from app.repositories import SesiRepository
from app.services.sesi.sesi_service import SesiService
from app.services.settings.settings_service import SettingsService
from app.utils.logger import write_log


from app.services.cache.command_store import (
    MAX_COMMAND_QUEUE_PER_PC,
    CommandQueueStore,
    CommandQueueDict,
    PENDING_COMMANDS,
    PENDING_FAST_COMMANDS,
    PENDING_VNC_COMMANDS
)


class ClientService:
    """Service untuk endpoint client C# / Rust."""

    # Umur maksimum heartbeat di DB sebelum ditulis ulang (detik)
    HEARTBEAT_PERSIST_SECONDS = 30

    @staticmethod
    def queue_command(pc_id, command_type):
        """Menambahkan perintah ke antrean polling reguler PC (GUI)."""
        CommandQueueStore.push_command(pc_id, command_type)

    @staticmethod
    def queue_fast_command(pc_id, command_type):
        """Menambahkan perintah cepat on-demand ke antrean PC (Monitor Agent / Remote Control)."""
        CommandQueueStore.push_fast_command(pc_id, command_type)

    @staticmethod
    def pop_command(pc_id):
        """Mengambil perintah reguler FIFO dari antrean."""
        return CommandQueueStore.pop_command(pc_id)

    @staticmethod
    def pop_fast_command(pc_id):
        """Mengambil perintah cepat FIFO dari antrean."""
        return CommandQueueStore.pop_fast_command(pc_id)

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
        persist_beat = False
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

            # Update Last Activity in RAM Store (DB pc.last_activity bukan sumber kebenaran)
            from app.services.cache.memory_store import OnlineStatusStore, UptimeMemoryStore
            OnlineStatusStore.mark_active(pc.id, dt=now_local())

            # B. Cek Sesi Aktif
            sesi = SesiRepository.get_aktif_by_pc(pc.id)
            UptimeMemoryStore.set_billing(pc.id, bool(sesi))
            
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
                    # C. Sesi Ada -> tandai heartbeat & hitung sisa waktu
                    try:
                        now = now_local()
                        last_persisted = sesi.last_sync
                        if (last_persisted is None
                                or (now - last_persisted).total_seconds()
                                >= ClientService.HEARTBEAT_PERSIST_SECONDS):
                            sesi.last_sync = now
                            persist_beat = True
                    except Exception as beat_err:
                        write_log("CLIENT_HEARTBEAT_ERROR",
                                  f"Gagal siapkan heartbeat PC {pc.kode}: {beat_err}")

                    try:
                        sisa = SesiService.sync_waktu_member(sesi)
                    except Exception as inner_e:
                        write_log("CLIENT_STATUS_ERROR", f"Error sync PC {pc.kode}: {inner_e}")
                        sisa = 0

                    # D. Jika Waktu Habis -> Selesaikan Sesi
                    if sisa <= 0:
                        SesiService.tutup_sesi(sesi.id, operator="system")

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

                        is_member = bool(sesi and sesi.tipe == "member" and sesi.member)
                        member_data = sesi.member.to_dict(sesi=sesi) if is_member else None

                        res = {
                            "status": status_text,
                            "sisa_waktu": sisa,
                            "nama": sesi.member.username if sesi.member else (sesi.nama_guest or "Guest"),
                            "grup": pc.grup.nama if pc.grup else "reguler",
                            "pc_kode": pc.kode,
                            "is_afk": sesi.is_afk or False,
                            "shutdown_timer": 0,
                            "is_member": is_member,
                            "member": member_data
                        }

            if res:
                res["polling_interval"] = SettingsService.get_client_polling_interval()
                if "command" not in res:
                    cmd = ClientService.pop_command(pc.id)
                    if cmd:
                        res["command"] = cmd

            if persist_beat:
                try:
                    db.session.commit()
                except Exception as beat_err:
                    db.session.rollback()
                    write_log("CLIENT_HEARTBEAT_ERROR",
                              f"Gagal simpan heartbeat PC {pc.kode}: {beat_err}")

            return res


        except Exception as e:
            try:
                db.session.rollback()
            except Exception:
                pass
            write_log("CLIENT_STATUS_CRASH", f"Error fatal polling {ip_address}: {e}")
            return {"status": "error", "message": "Server error"}


    # =========================================================================
    # 2. EMERGENCY LOGIN (OFFLINE-FIRST ADMIN)
    # =========================================================================
    # Fokus: Login admin dari PC client tanpa harus validasi user DB.
    # Emergency login selalu diterima server, dan mengaktifkan is_admin_mode.

    @staticmethod
    def emergency_login(ip_address, mac_address, username="SYSTEM", token=None, request_ip=None):
        """Login emergency dari PC client.

        Diizinkan bila token server valid ATAU request datang dari IP PC itu sendiri
        (IP LAN tidak bisa dipalsukan dari PC lain), sehingga admin PC tetap bisa
        unlock walau token server tidak tersedia di client.
        """
        pc = PCRepository.get_by_ip(ip_address)
        if not pc:
            raise ValueError("IP PC tidak terdaftar")

        token_ok = bool(token) and hmac.compare_digest(
            str(token), str(SettingsService.get_or_create_emergency_token())
        )
        ip_ok = bool(request_ip) and str(request_ip) == str(pc.ip_address)
        if not token_ok and not ip_ok:
            write_log("SECURITY_ALERT", f"Emergency login ditolak: token tidak valid (IP {ip_address})")
            raise PermissionError("Token emergency login tidak valid")

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
        session_token = secrets.token_hex(32)
        pc.is_admin_mode = True
        pc.last_activity = now_local()
        SesiService.buka_admin(pc.id, session_token, admin_nama="SYSTEM")
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
            try:
                db.session.rollback()
            except Exception:
                pass
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