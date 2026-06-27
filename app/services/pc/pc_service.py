# app/services/pc_service.py

"""Service untuk manajemen PC/unit komputer.

Modul ini menangani CRUD PC, bulk creation, dan status summary.
"""

from app.models import PC
from app.repositories import PCRepository
from app.repositories import SesiRepository
from app.repositories import GrupRepository
from app.utils.logger import write_log
from app.models import db


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
        
        if PCRepository.get_by_kode(kode):
            raise ValueError(f"PC dengan kode {kode} sudah ada")

        # --- VALIDASI IP ADDRESS UNIK ---
        ip_address = data.get("ip_address")
        if ip_address:
            ip_address = ip_address.strip()
            if PCRepository.find_by_ip(ip_address):
                raise ValueError(f"IP Address '{ip_address}' sudah digunakan oleh PC lain")

        # --- VALIDASI MAC ADDRESS UNIK ---
        mac_address = data.get("mac_address")
        if mac_address:
            mac_address = mac_address.strip()
            if PCRepository.find_by_mac(mac_address):
                raise ValueError(f"MAC Address '{mac_address}' sudah digunakan oleh PC lain")

        grup_nama = data.get("grup", "reguler")
        grup_obj = GrupRepository.find_by_nama(grup_nama)
        if not grup_obj:
            raise ValueError(f"Grup '{grup_nama}' tidak ditemukan. Buat dulu di menu Grup.")

        pc = PC(
            kode=kode,
            nama=data.get("nama") or kode,
            ip_address=ip_address,
            mac_address=mac_address,
            grup_id=grup_obj.id,
        )
        
        db.session.add(pc)
        db.session.commit()
        write_log("TAMBAH_PC", f"PC {kode} ({grup_nama}) didaftarkan", user=operator)
        return pc

    @staticmethod
    def update(pc_id, data, operator="system"):
        """Perbarui informasi teknis PC (Kode, Nama, IP, MAC, Grup) dengan validasi duplikasi."""
        pc = PCRepository.get_by_id(pc_id)
        
        # 1. Validasi Kode Baru
        if "kode" in data:
            kode_baru = data["kode"].strip()
            if kode_baru and kode_baru != pc.kode:
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
            ip_baru = data["ip_address"]
            if ip_baru:
                ip_baru = ip_baru.strip()
                if ip_baru != pc.ip_address:
                    if PCRepository.find_by_ip(ip_baru):
                        raise ValueError(f"IP Address '{ip_baru}' sudah digunakan oleh PC lain")
                    pc.ip_address = ip_baru
            else:
                pc.ip_address = None

        # 4. Validasi MAC Address Baru
        if "mac_address" in data:
            mac_baru = data["mac_address"]
            if mac_baru:
                mac_baru = mac_baru.strip()
                if mac_baru != pc.mac_address:
                    if PCRepository.find_by_mac(mac_baru):
                        raise ValueError(f"MAC Address '{mac_baru}' sudah digunakan oleh PC lain")
                    pc.mac_address = mac_baru
            else:
                pc.mac_address = None
        
        pc.nama = data.get("nama", pc.nama)
        
        db.session.commit()
        write_log("EDIT_PC", f"Data PC {pc.kode} diperbarui", user=operator)
        return pc

    @staticmethod
    def delete(pc_id, operator="system"):
        """Hapus unit PC secara permanen dari sistem."""
        pc = PCRepository.get_by_id(pc_id)
        db.session.delete(pc)
        db.session.commit()
        write_log("HAPUS_PC", f"PC:{pc.kode} dihapus permanen", user=operator)
        return {"success": True, "message": f"PC {pc.kode} berhasil dihapus"}

    @staticmethod
    def update_position(pc_id, pos_x, pos_y):
        """Update posisi PC di floor plan."""
        pc = PCRepository.get_by_id(pc_id)
        pc.pos_x = pos_x
        pc.pos_y = pos_y
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
        db.session.commit()
        write_log("RESET_ADMIN", f"Mode Admin PC {pc.kode} dimatikan paksa", user=operator)
        return True

    @staticmethod
    def create_batch(data, operator="system"):
        """Tambah PC massal dengan IP Range Start & End serta validasi duplikasi IP."""
        prefix = data.get("prefix", "PC-").upper()
        start_n = int(data.get("start_num", 1))
        end_n = int(data.get("end_num", 5))
        grup_nama = data.get("grup", "reguler")
        
        ip_start = data.get("ip_start")
        
        grup_obj = GrupRepository.find_by_nama(grup_nama)
        if not grup_obj:
            raise ValueError(f"Grup {grup_nama} tidak ditemukan")

        if not ip_start:
            raise ValueError("IP Address Awal wajib diisi")

        ip_parts = ip_start.split('.')
        if len(ip_parts) != 4:
            raise ValueError("Format IP Address Awal tidak valid (wajib X.X.X.X)")

        try:
            subnet = ".".join(ip_parts[:3])
            current_octet = int(ip_parts[3])
        except (ValueError, IndexError):
            raise ValueError("IP Address Awal memiliki segmen angka yang tidak valid")

        # Loop pertama: Validasi seluruh PC terlebih dahulu (Atomic check)
        temp_octet = current_octet
        for i in range(start_n, end_n + 1):
            kode = f"{prefix}{i}"
            generated_ip = f"{subnet}.{temp_octet}"

            # 1. Validasi Kode PC
            existing_code_pc = PCRepository.find_by_kode(kode)
            if existing_code_pc:
                raise ValueError(f"Kode PC {kode} sudah ada di database")

            # 2. Validasi IP Address
            existing_ip_pc = PCRepository.find_by_ip(generated_ip)
            if existing_ip_pc:
                raise ValueError(f"{kode} ipnya ketabrak sama {existing_ip_pc.kode} ({generated_ip})")

            temp_octet += 1

        # Loop kedua: Jika validasi lolos semua, barulah kita simpan ke database
        pc_to_save = []
        added = []
        for i in range(start_n, end_n + 1):
            kode = f"{prefix}{i}"
            generated_ip = f"{subnet}.{current_octet}"
            
            pc = PC(
                kode=kode,
                nama=f"{prefix}{i}",
                ip_address=generated_ip,
                grup_id=grup_obj.id,
                aktif=True
            )
            pc_to_save.append(pc)
            added.append(kode)
            current_octet += 1

        if pc_to_save:
            db.session.add_all(pc_to_save)
            db.session.commit()
            write_log("BATCH_PC", f"Tambah {len(added)} PC via IP Range", user=operator)
            
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

        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        # Windows: must bind before broadcast sendto
        try:
            sock.bind(('0.0.0.0', 0))
        except OSError:
            pass
        try:
            # Try global broadcast first, fallback to subnet-directed
            sock.sendto(magic_packet, ('255.255.255.255', 9))
        except OSError:
            try:
                sock.sendto(magic_packet, ('192.168.1.255', 9))
            except OSError:
                raise
        finally:
            sock.close()
        
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
                write_log("WOL_PACKET", f"Magic Packet terkirim ke {mac}", user=operator)
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
                write_log("WOL_PACKET", f"Magic Packet terkirim ke {pc.kode} ({pc.mac_address})", user=operator)
            except Exception as e:
                results["errors"].append({"pc_id": pc_id, "error": f"{pc.kode}: {str(e)}"})
        return results