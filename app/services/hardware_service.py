# app/services/hardware_service.py

"""Service untuk monitoring hardware PC client.

Module ini memproses data telemetry yang dikirim secara periodik
oleh C# Hardware Monitor Agent dan menyimpannya ke database
untuk ditampilkan di dashboard kasir.
"""

from app.models.base import db
from app.models.hardware import HardwareMonitor
from app.repositories.hardware_repository import HardwareRepository
from app.repositories.process_repository import ProcessRepository
from app.repositories.pc_repository import PCRepository
from app.utils.logger import write_log

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

            # 6. Simpan secara atomik di Service Layer
            db.session.add(hardware)
            db.session.commit()
            
            return pc
            
        except Exception as e:
            db.session.rollback()
            write_log("MONITOR_ERROR", f"Failed to process hardware metric for IP {client_ip}: {str(e)}")
            raise

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
