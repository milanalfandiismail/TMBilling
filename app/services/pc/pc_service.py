# app/services/pc_service.py

"""Service untuk manajemen PC/unit komputer.

Modul ini menangani CRUD PC, bulk creation, dan status summary.
"""

from app.models import PC, db, now_local
from app.repositories import PCRepository
from app.repositories import SesiRepository
from app.repositories import GrupRepository
from app.utils.logger import write_log
from app.utils.validators import validate_string_length, validate_integer_range, validate_ip_address, validate_mac_address


class PCService:
    """Service untuk business logic PC."""

    # =========================================================================
    # 1. PENGAMBILAN DATA & RINGKASAN (READ & SUMMARY)
    # =========================================================================
    # Fokus: Menampilkan daftar PC, detail per unit, dan status dashboard.

    @staticmethod
    def get_all(aktif_only=False, grup_id=None, search_query=None):
        """Ambil semua PC melalui repository dengan Natural Sorting (Alphanumeric) dan filter opsional."""
        grup_id_parsed = None
        if grup_id:
            if isinstance(grup_id, int):
                grup_id_parsed = grup_id
            elif str(grup_id).isdigit():
                grup_id_parsed = int(grup_id)
            else:
                grup_obj = GrupRepository.find_by_nama(grup_id)
                if grup_obj:
                    grup_id_parsed = grup_obj.id
        pcs = PCRepository.get_all(aktif_only, grup_id_parsed, search_query)
        import re
        
        def natural_sort_key(pc):
            g_id = pc.grup_id or 0
            code = pc.kode or ""
            # Pisahkan angka dari teks untuk perbandingan alami (human sorting)
            split_parts = [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', code)]
            return (g_id, split_parts)

        pcs.sort(key=natural_sort_key)
        return pcs

    @staticmethod
    def get_paginated(search_query=None, grup_id=None, page=1, per_page=12, aktif_only=False):
        """Ambil PC terpaginasi dengan sorting dan filter."""
        grup_id_parsed = None
        if grup_id:
            if isinstance(grup_id, int):
                grup_id_parsed = grup_id
            elif str(grup_id).isdigit():
                grup_id_parsed = int(grup_id)
            else:
                grup_obj = GrupRepository.find_by_nama(grup_id)
                if grup_obj:
                    grup_id_parsed = grup_obj.id
        return PCRepository.get_paginated(aktif_only, grup_id_parsed, page, per_page, search_query)

    @staticmethod
    def get_by_id(pc_id):
        """Mengambil detail profil PC berdasarkan ID."""
        return PCRepository.get_by_id(pc_id)

    @staticmethod
    def get_by_kode(kode):
        """Mengambil detail profil PC berdasarkan kode PC."""
        return PCRepository.get_by_kode(kode)

    @staticmethod
    def get_status_summary():
        """Ringkasan cepat status PC (Total, Terpakai, Kosong) untuk dashboard."""
        all_pc = PCRepository.get_all(aktif_only=True)
        total = len(all_pc)
        terpakai = sum(1 for pc in all_pc if pc.sesi_aktif)
        return {
            "total": total, 
            "terpakai": terpakai, 
            "kosong": total - terpakai
        }

    @staticmethod
    def group_by_grup(pcs):
        """Kelompokkan list PC ke dalam dictionary berdasarkan nama grup."""
        result = {}
        for pc in pcs:
            g = pc.grup.nama if pc.grup else "reguler"
            if g not in result:
                result[g] = []
            result[g].append(pc.to_dict())
        return result


    # =========================================================================
    # 2. MANAJEMEN UNIT (CREATE, UPDATE, DELETE)
    # =========================================================================
    # Fokus: Operasi standar untuk mengelola unit PC secara individu.

    @staticmethod
    def create(data, operator="system"):
        """Daftarkan unit PC baru dengan validasi kode dan IP unik."""
        kode = data.get("kode", "").strip().upper()
        if not kode:
            raise ValueError("Kode PC wajib diisi")
        if len(kode) > 11:
            raise ValueError("Kode PC maksimal 11 karakter")
        import re
        if not re.match(r'^[A-Za-z0-9\-_]+$', kode):
            raise ValueError("Kode PC hanya boleh berisi huruf, angka, tanda hubung (-), atau garis bawah (_)")
        
        if PCRepository.get_by_kode(kode):
            raise ValueError(f"PC dengan kode {kode} sudah ada")

        # --- VALIDASI IP ADDRESS UNIK ---
        ip_address = validate_ip_address(data.get("ip_address"), allow_empty=True, version=4)
        if ip_address and PCRepository.find_by_ip(ip_address):
            raise ValueError(f"IP Address '{ip_address}' sudah digunakan oleh PC lain")

        # --- VALIDASI MAC ADDRESS UNIK ---
        mac_address = validate_mac_address(data.get("mac_address"), allow_empty=True)
        if mac_address and PCRepository.find_by_mac(mac_address):
            raise ValueError(f"MAC Address '{mac_address}' sudah digunakan oleh PC lain")

        grup_nama = data.get("grup", "reguler")
        grup_obj = GrupRepository.find_by_nama(grup_nama)
        if not grup_obj:
            raise ValueError(f"Grup '{grup_nama}' tidak ditemukan. Buat dulu di menu Grup.")

        nama_pc = validate_string_length(data.get("nama") or kode, min_len=1, max_len=50, field_name="Nama PC", required=False)

        pc = PC(
            kode=kode,
            nama=nama_pc,
            ip_address=ip_address,
            mac_address=mac_address,
            grup_id=grup_obj.id,
        )
        
        db.session.add(pc)
        db.session.commit()
        
        detail_pc = {
            "kode": kode,
            "nama": pc.nama,
            "ip_address": ip_address,
            "mac_address": mac_address,
            "grup": grup_nama
        }
        write_log("TAMBAH_PC", f"PC {kode} ({grup_nama}) didaftarkan", user=operator, detail_json=detail_pc)
        return pc

    @staticmethod
    def update(pc_id, data, operator="system"):
        """Perbarui informasi teknis PC (Kode, Nama, IP, MAC, Grup) dengan validasi duplikasi."""
        pc = PCRepository.get_by_id(pc_id)
        if not pc:
            raise ValueError("PC tidak ditemukan")
        
        # 1. Validasi Kode Baru
        if "kode" in data:
            kode_baru = data["kode"].strip().upper()
            if kode_baru and kode_baru != pc.kode:
                if len(kode_baru) > 11:
                    raise ValueError("Kode PC maksimal 11 karakter")
                import re
                if not re.match(r'^[A-Za-z0-9\-_]+$', kode_baru):
                    raise ValueError("Kode PC hanya boleh berisi huruf, angka, tanda hubung (-), atau garis bawah (_)")
                if PCRepository.find_by_kode(kode_baru):
                    raise ValueError(f"Kode PC '{kode_baru}' sudah digunakan")
                pc.kode = kode_baru
        
        # 2. Validasi Grup Baru
        if "grup" in data:
            grup_obj = GrupRepository.find_by_nama(data["grup"])
            if not grup_obj:
                raise ValueError("Grup tidak valid")
            pc.grup_id = grup_obj.id
        
        # 3. Validasi IP Address Baru
        if "ip_address" in data:
            ip_baru = validate_ip_address(data["ip_address"], allow_empty=True, version=4)
            if ip_baru:
                if ip_baru != pc.ip_address:
                    if PCRepository.find_by_ip(ip_baru):
                        raise ValueError(f"IP Address '{ip_baru}' sudah digunakan oleh PC lain")
                    pc.ip_address = ip_baru
            else:
                pc.ip_address = None

        # 4. Validasi MAC Address Baru
        if "mac_address" in data:
            mac_baru = validate_mac_address(data["mac_address"], allow_empty=True)
            if mac_baru:
                if mac_baru != pc.mac_address:
                    if PCRepository.find_by_mac(mac_baru):
                        raise ValueError(f"MAC Address '{mac_baru}' sudah digunakan oleh PC lain")
                    pc.mac_address = mac_baru
            else:
                pc.mac_address = None
        
        if "nama" in data and data["nama"] is not None:
            pc.nama = validate_string_length(data["nama"], min_len=1, max_len=50, field_name="Nama PC", required=False)
        
        db.session.commit()
        
        detail_pc = {
            "kode": pc.kode,
            "nama": pc.nama,
            "ip_address": pc.ip_address,
            "mac_address": pc.mac_address,
            "grup": pc.grup.nama if pc.grup else ""
        }
        write_log("EDIT_PC", f"Data PC {pc.kode} diperbarui", user=operator, detail_json=detail_pc)
        return pc

    @staticmethod
    def delete(pc_id, operator="system"):
        """Hapus unit PC secara permanen dari sistem beserta seluruh dependensinya."""
        import os
        from flask import current_app
        from app.models import PCUptimeLog, HardwareMonitor, PCProcess, MaintenanceTicket, Sesi

        pc = PCRepository.get_by_id(pc_id)
        if not pc:
            raise ValueError("PC tidak ditemukan")

        # 1. Proteksi Sesi Aktif
        if pc.sesi_aktif:
            raise ValueError(f"PC {pc.kode} tidak dapat dihapus karena sedang digunakan dalam sesi aktif. Harap selesaikan sesi terlebih dahulu.")

        kode = pc.kode
        try:
            # 2. Detach sesi historis (Category B) agar histori keuangan tetap utuh
            Sesi.query.filter_by(pc_id=pc.id).update({"pc_id": None})

            # 3. Hapus seluruh data anak langsung (Category A)
            PCUptimeLog.query.filter_by(pc_id=pc.id).delete()
            HardwareMonitor.query.filter_by(pc_id=pc.id).delete()
            PCProcess.query.filter_by(pc_id=pc.id).delete()
            MaintenanceTicket.query.filter_by(pc_id=pc.id).delete()

            # 4. Hapus entitas PC
            db.session.delete(pc)
            db.session.commit()

            # 5. Cleanup In-Memory states (Non-fatal)
            try:
                from app.services.hardware.hardware_service import TELEMETRY_HISTORY
                TELEMETRY_HISTORY.pop(pc_id, None)
            except Exception:
                pass

            try:
                from app.services.client.client_service import PENDING_COMMANDS
                PENDING_COMMANDS.pop(pc_id, None)
            except Exception:
                pass

            # 6. Cleanup screenshot file di filesystem jika ada
            try:
                screenshot_path = os.path.join(current_app.root_path, 'static', 'uploads', 'screenshots', f"{kode}.png")
                if os.path.exists(screenshot_path):
                    os.remove(screenshot_path)
            except Exception:
                pass

            write_log("HAPUS_PC", f"PC:{kode} dihapus permanen beserta seluruh dependensinya", user=operator, detail_json={"kode": kode, "pc_id": pc_id})
            return {"success": True, "message": f"PC {kode} berhasil dihapus"}

        except Exception as e:
            db.session.rollback()
            write_log("HAPUS_PC_ERROR", f"Gagal menghapus PC {kode}: {str(e)}", user=operator)
            raise e

    @staticmethod
    def update_position(pc_id, pos_x, pos_y):
        """Update posisi PC di floor plan."""
        pc = PCRepository.get_by_id(pc_id)
        if not pc:
            raise ValueError("PC tidak ditemukan")
        pc.pos_x = validate_integer_range(pos_x, 0, 10000, "Posisi X")
        pc.pos_y = validate_integer_range(pos_y, 0, 10000, "Posisi Y")
        db.session.commit()
        return pc


    # =========================================================================
    # 3. OTOMASI & MASS OPERATION (BATCH)
    # =========================================================================
    # Fokus: Penambahan unit PC dalam jumlah besar secara otomatis.

    @staticmethod
    def reset_admin_mode(pc_id, operator="system"):
        """Matiin mode admin secara paksa di database."""
        pc = PCRepository.get_by_id(pc_id)
        if not pc:
            raise ValueError("PC tidak ditemukan")
        
        pc.is_admin_mode = False
        
        # Tutup sesi admin jika ada
        from app.repositories import SesiRepository
        sesi_aktif = SesiRepository.get_aktif_by_pc(pc.id)
        if sesi_aktif and sesi_aktif.tipe == "admin":
            sesi_aktif.status = "selesai"
            sesi_aktif.selesai_pada = now_local()

        db.session.commit()
        write_log("RESET_ADMIN", f"Mode Admin PC {pc.kode} dimatikan paksa", user=operator, detail_json={"kode": pc.kode})
        return True

    @staticmethod
    def create_batch(data, operator="system"):
        """Tambah PC massal dengan IP Range Start & End serta validasi duplikasi IP dan keselarasan jumlah unit."""
        import ipaddress
        import re

        prefix_raw = str(data.get("prefix", "PC") or "").strip().upper()
        clean_prefix = prefix_raw.rstrip("-_")
        if len(clean_prefix) > 6:
            raise ValueError("Prefix Kode PC maksimal 6 karakter")
        if clean_prefix and not re.match(r'^[A-Za-z0-9\-_]+$', clean_prefix):
            raise ValueError("Prefix Kode PC hanya boleh berisi huruf, angka, tanda hubung (-), atau garis bawah (_)")
        
        try:
            start_n = int(data.get("start_num", 1))
            end_n = int(data.get("end_num", 1))
        except (ValueError, TypeError):
            raise ValueError("Nomor unit harus berupa angka valid")

        if start_n < 1 or end_n > 9999 or len(str(end_n)) > 4 or len(str(start_n)) > 4:
            raise ValueError("Nomor unit harus berada di antara 1 sampai 9999 (maksimal 4 digit)")

        if start_n > end_n:
            raise ValueError(f"Nomor awal ({start_n}) tidak boleh lebih besar dari nomor akhir ({end_n})")

        pc_count = end_n - start_n + 1

        grup_nama = data.get("grup", "reguler")
        grup_obj = GrupRepository.find_by_nama(grup_nama)
        if not grup_obj:
            raise ValueError(f"Grup {grup_nama} tidak ditemukan")

        ip_start_str = str(data.get("ip_start") or "").strip()
        ip_end_str = str(data.get("ip_end") or "").strip()

        if not ip_start_str:
            raise ValueError("IP Address Awal wajib diisi")
        if not ip_end_str:
            raise ValueError("IP Address Akhir wajib diisi")

        try:
            ip_start_obj = ipaddress.IPv4Address(ip_start_str)
        except Exception:
            raise ValueError(f"Format IP Address Awal '{ip_start_str}' tidak valid (wajib format IPv4 X.X.X.X)")

        try:
            ip_end_obj = ipaddress.IPv4Address(ip_end_str)
        except Exception:
            raise ValueError(f"Format IP Address Akhir '{ip_end_str}' tidak valid (wajib format IPv4 X.X.X.X)")

        if int(ip_start_obj) > int(ip_end_obj):
            raise ValueError(f"IP Address Awal ({ip_start_str}) tidak boleh lebih besar dari IP Address Akhir ({ip_end_str})")

        ip_count = int(ip_end_obj) - int(ip_start_obj) + 1
        if ip_count != pc_count:
            if ip_count < pc_count:
                raise ValueError(
                    f"Rentang IP Address ({ip_count} IP: {ip_start_str} s/d {ip_end_str}) kurang dari jumlah unit PC yang akan didaftarkan ({pc_count} PC: unit {start_n} s/d {end_n}). Harap sesuaikan IP Address Akhir!"
                )
            else:
                raise ValueError(
                    f"Rentang IP Address ({ip_count} IP: {ip_start_str} s/d {ip_end_str}) lebih banyak dari jumlah unit PC yang akan didaftarkan ({pc_count} PC: unit {start_n} s/d {end_n}). Harap sesuaikan IP Address Akhir!"
                )

        def _build_batch_code(idx):
            return f"{clean_prefix}-{idx}" if clean_prefix else str(idx)

        # Loop pertama: Validasi seluruh PC & IP terlebih dahulu (Atomic check)
        for offset, i in enumerate(range(start_n, end_n + 1)):
            kode = _build_batch_code(i)
            if len(kode) > 11:
                raise ValueError(f"Kode PC '{kode}' melebihi batas maksimal 11 karakter")
            
            generated_ip = str(ipaddress.IPv4Address(int(ip_start_obj) + offset))

            # 1. Validasi Kode PC
            existing_code_pc = PCRepository.find_by_kode(kode)
            if existing_code_pc:
                raise ValueError(f"Kode PC {kode} sudah ada di database")

            # 2. Validasi IP Address
            existing_ip_pc = PCRepository.find_by_ip(generated_ip)
            if existing_ip_pc:
                raise ValueError(f"PC {kode} dengan IP {generated_ip} bentrok dengan PC {existing_ip_pc.kode}")

        # Loop kedua: Jika validasi lolos semua, simpan ke database
        pc_to_save = []
        added = []
        for offset, i in enumerate(range(start_n, end_n + 1)):
            kode = _build_batch_code(i)
            generated_ip = str(ipaddress.IPv4Address(int(ip_start_obj) + offset))
            
            pc = PC(
                kode=kode,
                nama=kode,
                ip_address=generated_ip,
                grup_id=grup_obj.id,
                aktif=True
            )
            pc_to_save.append(pc)
            added.append(kode)

        if pc_to_save:
            db.session.add_all(pc_to_save)
            db.session.commit()
            
            detail_batch = {
                "jumlah_ditambahkan": len(added),
                "daftar_kode": added,
                "grup": grup_nama,
                "ip_range": f"{ip_start_str} - {ip_end_str}"
            }
            write_log("BATCH_PC", f"Tambah {len(added)} PC via IP Range ({ip_start_str} - {ip_end_str})", user=operator, detail_json=detail_batch)
            
        return {"added": added, "errors": []}


    # =========================================================================
    # 4. WAKE-ON-LAN (WoL)
    # =========================================================================
    # Fokus: Mengirim Magic Packet UDP ke MAC Address target agar PC menyala.

    @staticmethod
    def send_wol_packet(mac_address: str) -> bool:
        """Kirim Magic Packet UDP ke MAC Address untuk menyalakan PC (WoL).
        
        Magic packet terdiri dari 6 byte FF diikuti MAC Address yang diulang 16x.
        
        Args:
            mac_address (str): Alamat MAC dalam format 'XX:XX:XX:XX:XX:XX' atau 'XX-XX-XX-XX-XX-XX'.
            
        Returns:
            bool: True jika packet berhasil dikirim.
            
        Raises:
            ValueError: Jika MAC Address tidak valid atau kosong.
        """
        import socket

        if not mac_address:
            raise ValueError("MAC Address tidak boleh kosong")

        clean_mac = mac_address.replace(":", "").replace("-", "").upper()
        if len(clean_mac) != 12:
            raise ValueError(f"Format MAC Address tidak valid: {mac_address}")

        try:
            mac_bytes = bytes.fromhex(clean_mac)
        except ValueError:
            raise ValueError(f"MAC Address mengandung karakter tidak valid: {mac_address}")

        # Bangun Magic Packet: 6x 0xFF + MAC address diulang 16 kali
        magic_packet = b'\xff' * 6 + mac_bytes * 16

        # Cari semua IP lokal dari server (tanpa library tambahan psutil)
        hostname = socket.gethostname()
        try:
            _, _, ip_addresses = socket.gethostbyname_ex(hostname)
        except Exception:
            ip_addresses = []

        if not ip_addresses:
            ip_addresses = ['0.0.0.0']

        sent_any = False
        
        # Broadcast via setiap NIC (Network Interface)
        for ip in ip_addresses:
            # Skip loopback
            if ip.startswith("127."):
                continue
                
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            
            try:
                # Bind ke IP spesifik dari NIC ini agar OS me-routing broadcast lewat NIC yang tepat
                sock.bind((ip, 0))
                sock.sendto(magic_packet, ('255.255.255.255', 9))
                sent_any = True
            except OSError:
                pass
            finally:
                sock.close()
        
        # Fallback jika gethostbyname gagal atau loopback semua
        if not sent_any:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            try:
                sock.bind(('0.0.0.0', 0))
            except OSError:
                pass
            
            try:
                sock.sendto(magic_packet, ('255.255.255.255', 9))
                sent_any = True
            except OSError:
                pass
            finally:
                sock.close()
        
        if not sent_any:
            raise OSError("Gagal mengirim WOL packet ke semua interface")
        
        return True

    @staticmethod
    def wake_on_lan(mac_addresses: list, operator: str = "system") -> dict:
        """Kirim WoL Magic Packet ke satu atau beberapa MAC Address.
        
        Args:
            mac_addresses (list): Daftar MAC Address yang akan dikirim packet.
            operator (str): Username kasir yang memicu aksi.
            
        Returns:
            dict: {'success': [...], 'errors': [...]}
        """
        results = {"success": [], "errors": []}
        for mac in mac_addresses:
            try:
                PCService.send_wol_packet(mac)
                results["success"].append(mac)
                write_log("WOL_PACKET", f"Magic Packet terkirim ke {mac}", user=operator, detail_json={"mac": mac})
            except Exception as e:
                results["errors"].append({"mac": mac, "error": str(e)})
        return results

    @staticmethod
    def wake_by_pc_ids(pc_ids: list, operator: str = "system") -> dict:
        """Kirim WoL ke sejumlah PC berdasarkan ID PC.
        
        Args:
            pc_ids (list): Daftar ID PC.
            operator (str): Username kasir yang memicu aksi.
            
        Returns:
            dict: {'success': [...list pc_kode...], 'errors': [...]}
        """
        results = {"success": [], "errors": []}
        for pc_id in pc_ids:
            pc = PCRepository.get_by_id(pc_id)
            if not pc:
                results["errors"].append({"pc_id": pc_id, "error": "PC tidak ditemukan"})
                continue
            if not pc.mac_address:
                results["errors"].append({"pc_id": pc_id, "error": f"{pc.kode} tidak memiliki MAC Address"})
                continue
            try:
                PCService.send_wol_packet(pc.mac_address)
                results["success"].append(pc.kode)
                write_log("WOL_PACKET", f"Magic Packet terkirim ke {pc.kode} ({pc.mac_address})", user=operator, detail_json={"kode": pc.kode, "mac": pc.mac_address})
            except Exception as e:
                results["errors"].append({"pc_id": pc_id, "error": f"{pc.kode}: {str(e)}"})
        return results