# app/services/hardware_service.py

"""Service untuk monitoring hardware PC client.

Module ini memproses data telemetry yang dikirim secara periodik
oleh C# Hardware Monitor Agent dan menyimpannya ke database
untuk ditampilkan di dashboard kasir.
"""

import re
from datetime import datetime
from app.models import db
from app.models import HardwareMonitor
from app.repositories import HardwareRepository
from app.repositories import ProcessRepository
from app.repositories import PCRepository
from app.utils.logger import write_log

# Histori telemetry in-memory global untuk deteksi warning PC
# Key: pc_id (int), Value: list of dict {"cpu_usage": float, "ram_usage_pct": float}
TELEMETRY_HISTORY = {}


class HardwareService:
    """Service untuk memproses log metric hardware PC."""

    @staticmethod
    def get_all_with_pc():
        """Mengambil semua data hardware monitor beserta relasi PC.

        Returns:
            list: List objek HardwareMonitor dengan relasi PC.
        """
        return HardwareRepository.get_all_with_pc()

    @staticmethod
    def process_hardware_metric(client_ip, data):
        """Memproses data metrics dan menyimpannya di database untuk PC terkait.
        
        Args:
            client_ip (str): IP Address dari client yang mengirim log.
            data (dict): Dictionary JSON payload dari client.
            
        Returns:
            PC: Object PC jika berhasil disimpan.
            
        Raises:
            ValueError: Jika PC tidak ditemukan berdasarkan IP/MAC.
        """
        try:
            # 1. Ambil MAC Address dan IP Address asli yang dikirim Agen
            mac_address = data.get("MacAddress", data.get("mac_address"))
            ip_address = data.get("IpAddress", data.get("ip_address"))

            pc = None

            # 2. Cari PC dengan prioritas: MAC -> IP dikirim -> IP koneksi HTTP
            if mac_address:
                pc = PCRepository.find_by_mac(mac_address)
            
            if not pc and ip_address:
                pc = PCRepository.find_by_ip(ip_address)
            
            if not pc:
                pc = PCRepository.get_by_ip(client_ip)

            # Jika tidak terdaftar sama sekali di database kasir, lemparkan error terhormat!
            if not pc:
                raise ValueError(f"PC dengan MAC '{mac_address}' atau IP '{ip_address}' belum terdaftar di database kasir.")

            # 3. Ambil atau buat objek HardwareMonitor baru
            hardware = HardwareRepository.get_by_pc_id(pc.id)
            if not hardware:
                hardware = HardwareMonitor(pc_id=pc.id)

            # 4. Update isi dari hardware monitor (Robust key fetching & rounded)
            hardware.cpu_usage = round(float(data.get("CpuUsage", data.get("cpuUsage", data.get("cpu_usage", 0.0)))), 1)
            hardware.cpu_temp = round(float(data.get("CpuTemp", data.get("cpuTemp", data.get("cpu_temp", 0.0)))), 1)
            hardware.gpu_temp = round(float(data.get("GpuTemp", data.get("gpuTemp", data.get("gpu_temp", 0.0)))), 1)
            hardware.total_ram = str(data.get("TotalRam", data.get("totalRam", data.get("total_ram", "Unknown"))))
            hardware.nic_speed = str(data.get("NicSpeed", data.get("nicSpeed", data.get("nic_speed", "Unknown"))))
            hardware.motherboard = str(data.get("Motherboard", data.get("motherboard", "Unknown")))
            hardware.cpu_name = str(data.get("CpuName", data.get("cpuName", data.get("cpu_name", "Unknown"))))
            hardware.gpu_name = str(data.get("GpuName", data.get("gpuName", data.get("gpu_name", "Unknown"))))
            
            # --- NEW: Process Monitoring Data ---
            hardware.active_window = str(data.get("ActiveWindow", data.get("active_window", hardware.active_window or "")))
            
            # 5. Sync Process List if provided
            process_list = data.get("ProcessList", data.get("processList", data.get("process_list")))
            if process_list is not None and isinstance(process_list, list):
                ProcessRepository.sync_processes(pc.id, process_list)

            # 6. Update Histori Telemetry In-Memory
            ram_pct = HardwareService.calculate_ram_pct(hardware.total_ram, process_list)
            if pc.id not in TELEMETRY_HISTORY:
                TELEMETRY_HISTORY[pc.id] = []
            
            TELEMETRY_HISTORY[pc.id].append({
                "cpu_usage": hardware.cpu_usage,
                "ram_usage_pct": ram_pct
            })
            
            if len(TELEMETRY_HISTORY[pc.id]) > 3:
                TELEMETRY_HISTORY[pc.id].pop(0)

            # 7. Simpan secara atomik di Service Layer
            db.session.add(hardware)
            db.session.commit()
            
            return pc
            
        except Exception as e:
            db.session.rollback()
            write_log("MONITOR_ERROR", f"Failed to process hardware metric for IP {client_ip}: {str(e)}")
            raise

    @staticmethod
    def calculate_ram_pct(total_ram_str, process_list):
        """Menghitung persentase RAM terpakai berdasarkan sum memori proses."""
        try:
            total_gb = 16.0
            parts = total_ram_str.lower().split()
            if parts:
                total_gb = float(parts[0])
            total_mb = total_gb * 1024.0
            
            used_mb = 0
            if process_list and isinstance(process_list, list):
                for p in process_list:
                    title = p.get("Title", p.get("title", ""))
                    match = re.search(r'(\d+)\s*mb', title.lower())
                    if match:
                        used_mb += int(match.group(1))
                        
            if total_mb > 0:
                return (used_mb / total_mb) * 100.0
        except Exception:
            pass
        return 0.0

    @staticmethod
    def check_pc_warning(pc_id, telemetry_data):
        """Memeriksa apakah data hardware memicu warning (suhu/CPU/RAM)."""
        warnings = []
        
        cpu_temp = float(telemetry_data.get("cpu_temp", 0.0) or 0.0)
        gpu_temp = float(telemetry_data.get("gpu_temp", 0.0) or 0.0)
        
        if cpu_temp > 85:
            warnings.append(f"Suhu CPU tinggi ({cpu_temp}°C)")
        if gpu_temp > 85:
            warnings.append(f"Suhu GPU tinggi ({gpu_temp}°C)")
            
        history = TELEMETRY_HISTORY.get(pc_id, [])
        if len(history) >= 3:
            cpu_overload = all(h.get("cpu_usage", 0.0) > 95 for h in history)
            ram_overload = all(h.get("ram_usage_pct", 0.0) > 95 for h in history)
            
            if cpu_overload:
                warnings.append("Beban CPU > 95% selama 3 menit")
            if ram_overload:
                warnings.append("Beban RAM > 95% selama 3 menit")
                
        return {
            "has_warning": len(warnings) > 0,
            "warnings": warnings
        }


    @staticmethod
    def get_processes_by_pc(pc_id):
        """Mengambil data proses untuk satu PC dalam format list dict."""
        processes = ProcessRepository.get_by_pc(pc_id)
        return [p.to_dict() for p in processes]

    @staticmethod
    def delete_hardware(hardware_id, operator="system"):
        """Menghapus data hardware monitor berdasarkan ID dan melakukan commit database."""
        try:
            m = HardwareRepository.get_by_id(hardware_id)
            if not m:
                raise ValueError("Data hardware monitor tidak ditemukan")
                
            pc_kode = m.pc.kode if m.pc else "Unknown"
            HardwareRepository.delete(m)
            db.session.commit()
            
            write_log("HAPUS_MONITOR", f"Data hardware monitor PC {pc_kode} dihapus manual oleh kasir", user=operator)
            return pc_kode
        except Exception as e:
            HardwareRepository.rollback()
            raise e
