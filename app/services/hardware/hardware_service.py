# app/services/hardware_service.py

"""Service untuk monitoring hardware PC client.

Module ini memproses data telemetry yang dikirim secara periodik
oleh C# Hardware Monitor Agent / Rust monitor. Menggunakan arsitektur
In-Memory Store untuk menghilangkan disk I/O dan lock contention di SQLite,
serta menerapkan Anti-Theft Grace Period 60 detik untuk mencegah false alarm saat booting.
"""

import re
import json
from datetime import datetime, timezone, timedelta
from app.utils.timezone_utils import now_utc, display_in_tz, get_tz_short_name
from app.models import db, HardwareMonitor
from app.repositories import HardwareRepository, ProcessRepository, PCRepository
from app.utils.helpers import natural_sort_key
from app.utils.logger import write_log
from app.services.cache.telemetry_store import (
    HardwareMetricsStore,
    ProcessMemoryStore,
    TelemetryHistoryStore
)
from app.services.cache.memory_store import (
    OnlineStatusStore,
    UptimeMemoryStore,
    AntiTheftGraceTracker
)

# Alias backward compatibility
TELEMETRY_HISTORY = TelemetryHistoryStore._store


class HardwareService:
    """Service untuk memproses log metric hardware PC."""

    @staticmethod
    def get_all_with_pc():
        """Mengambil semua data hardware monitor beserta relasi PC.
        Data metrik real-time diambil langsung dari HardwareMetricsStore (RAM).

        Returns:
            list: List objek HardwareMonitor dengan relasi PC.
        """
        monitors = HardwareRepository.get_all_with_pc()
        return sorted(monitors, key=lambda m: natural_sort_key(m.pc.kode if m.pc else ""))

    @staticmethod
    def process_hardware_metric(client_ip, data):
        """Memproses data metrics dan menyimpannya di In-Memory Store & Database.
        
        Zero Disk I/O Polling:
        - Metrik suhu, CPU, RAM, active window, dan process list disimpan di RAM.
        - Detak jantung uptime diakumulasikan di RAM dan di-flush periodik per 1 menit.
        - Database SQLite hanya di-commit jika ada baseline baru atau confirmed hardware mismatch.
        - Anti-Theft Grace Period: 60 detik toleransi cold start untuk mencegah false alarm saat booting.
        
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

            # 2. Cari PC dengan prioritas: RAM Cache -> MAC -> IP dikirim -> IP koneksi HTTP
            from app.services.cache.memory_store import PCNetworkCacheStore
            cached = PCNetworkCacheStore.resolve_pc(ip=ip_address or client_ip, mac=mac_address)
            if cached:
                pc = PCRepository.get_by_id(cached["id"])

            if not pc:
                if mac_address:
                    pc = PCRepository.find_by_mac(mac_address)
                if not pc and ip_address:
                    pc = PCRepository.find_by_ip(ip_address)
                if not pc:
                    pc = PCRepository.get_by_ip(client_ip)
                if pc:
                    PCNetworkCacheStore.invalidate()

            # Jika tidak terdaftar sama sekali di database kasir, lemparkan error terhormat!
            if not pc:
                raise ValueError(f"PC dengan MAC '{mac_address}' atau IP '{ip_address}' belum terdaftar di database kasir.")

            # 3. Update In-Memory Online Status & Anti-Theft Boot Tracker
            was_offline = not OnlineStatusStore.is_online(pc.id, timeout_seconds=15)
            if was_offline:
                AntiTheftGraceTracker.record_boot(pc.id)
            else:
                AntiTheftGraceTracker.record_boot_if_needed(pc.id)
            OnlineStatusStore.mark_active(pc.id)
            in_grace = AntiTheftGraceTracker.is_in_grace_period(pc.id, grace_seconds=60)

            # 4. Parse nilai metrik hardware
            cpu_usage = round(float(data.get("CpuUsage", data.get("cpuUsage", data.get("cpu_usage", 0.0)))), 1)
            cpu_temp = round(float(data.get("CpuTemp", data.get("cpuTemp", data.get("cpu_temp", 0.0)))), 1)
            gpu_temp = round(float(data.get("GpuTemp", data.get("gpuTemp", data.get("gpu_temp", 0.0)))), 1)
            total_ram = str(data.get("TotalRam", data.get("totalRam", data.get("total_ram", "Unknown"))))
            nic_speed = str(data.get("NicSpeed", data.get("nicSpeed", data.get("nic_speed", "Unknown"))))
            motherboard = str(data.get("Motherboard", data.get("motherboard", "Unknown")))
            cpu_name = str(data.get("CpuName", data.get("cpuName", data.get("cpu_name", "Unknown"))))
            gpu_name = str(data.get("GpuName", data.get("gpuName", data.get("gpu_name", "Unknown"))))
            active_window = str(data.get("ActiveWindow", data.get("active_window", "")))

            # 5. Sync Process List ke In-Memory RAM Store (Zero Disk I/O)
            process_list = data.get("ProcessList", data.get("processList", data.get("process_list")))
            if process_list is not None and isinstance(process_list, list):
                ProcessRepository.sync_processes(pc.id, process_list)

            # 6. Update Histori Telemetry In-Memory
            ram_pct = HardwareService.calculate_ram_pct(total_ram, process_list)
            TelemetryHistoryStore.push_metric(pc.id, cpu_usage, ram_pct, max_len=3)

            # 7. Akumulasi Heartbeat Uptime di RAM (Tanpa write DB setiap detik)
            is_billing = bool(pc.sesi_aktif)
            UptimeMemoryStore.record_heartbeat(pc.id, is_billing)

            # 8. Security Audit: Always-On Hardware Checker dengan Grace Period 60 Detik
            needs_commit = False
            hardware = HardwareRepository.get_by_pc_id(pc.id)
            if not hardware:
                hardware = HardwareMonitor(pc_id=pc.id)
                needs_commit = True

            # Update cache object model (jangan timpa data valid dengan Unknown)
            hardware.cpu_usage = cpu_usage
            hardware.cpu_temp = cpu_temp
            hardware.gpu_temp = gpu_temp
            hardware.total_ram = total_ram
            hardware.nic_speed = nic_speed
            if motherboard and motherboard != "Unknown":
                hardware.motherboard = motherboard
            if cpu_name and cpu_name != "Unknown":
                hardware.cpu_name = cpu_name
            if gpu_name and gpu_name != "Unknown":
                hardware.gpu_name = gpu_name
            hardware.active_window = active_window

            serials = data.get("HardwareSerials", data.get("hardwareSerials", data.get("hardware_serials")))
            if serials and isinstance(serials, dict):
                # Lengkapi serials dictionary jika ada info model valid
                if "GpuName" not in serials:
                    cand_gpu = gpu_name if gpu_name != "Unknown" else data.get("GpuName")
                    if cand_gpu and cand_gpu != "Unknown":
                        serials["GpuName"] = str(cand_gpu).strip()
                    elif hardware.gpu_name and hardware.gpu_name != "Unknown":
                        serials["GpuName"] = hardware.gpu_name

                if "Motherboard" not in serials:
                    cand_mobo = motherboard if motherboard != "Unknown" else data.get("Motherboard")
                    if cand_mobo and cand_mobo != "Unknown":
                        serials["Motherboard"] = str(cand_mobo).strip()
                    elif hardware.motherboard and hardware.motherboard != "Unknown":
                        serials["Motherboard"] = hardware.motherboard

                # Simpan specs telemetry saat ini
                hardware.hardware_current_specs = json.dumps(serials)

                # Jika baseline kosong dan hardware teridentifikasi, daftarkan baseline awal secara otomatis
                if not hardware.hardware_baseline:
                    gpu_valid = (serials.get("GpuPnpId") not in ("Unknown", None, "") 
                                 or serials.get("GpuName") not in ("Unknown", None, ""))
                    if gpu_valid or not in_grace:
                        hardware.hardware_baseline = json.dumps(serials)
                        hardware.hardware_mismatch = False
                        hardware.hardware_mismatch_desc = None
                        hardware.hardware_mismatch_time = None
                        hardware.hardware_last_sync = now_utc()
                        needs_commit = True
                else:
                    try:
                        baseline = json.loads(hardware.hardware_baseline)
                    except Exception:
                        baseline = None

                    if baseline and isinstance(baseline, dict):
                        mismatch_reasons = []

                        # A. Motherboard
                        base_mobo = str(baseline.get("MotherboardSerial") or "Unknown").strip()
                        curr_mobo = str(serials.get("MotherboardSerial") or "Unknown").strip()
                        if base_mobo not in ("Unknown", "", "None"):
                            if curr_mobo in ("Unknown", "", "None"):
                                if not in_grace:
                                    mismatch_reasons.append(f"Serial Motherboard hilang/tidak terdeteksi (sebelumnya '{base_mobo}')")
                            elif base_mobo != curr_mobo:
                                mismatch_reasons.append(f"Motherboard berubah (dari '{base_mobo}' ke '{curr_mobo}')")

                        # B. CPU
                        base_cpu = str(baseline.get("CpuId") or "Unknown").strip()
                        curr_cpu = str(serials.get("CpuId") or "Unknown").strip()
                        if base_cpu not in ("Unknown", "", "None"):
                            if curr_cpu in ("Unknown", "", "None"):
                                if not in_grace:
                                    mismatch_reasons.append(f"Processor ID hilang/tidak terdeteksi (sebelumnya '{base_cpu}')")
                            elif base_cpu != curr_cpu:
                                mismatch_reasons.append(f"Processor ID berubah (dari '{base_cpu}' ke '{curr_cpu}')")

                        # C. GPU (Anti-Theft dengan toleransi 60 detik)
                        base_gpu_pnp = str(baseline.get("GpuPnpId") or "Unknown").strip()
                        curr_gpu_pnp = str(serials.get("GpuPnpId") or "Unknown").strip()
                        base_gpu_name = str(baseline.get("GpuName") or "").strip()
                        curr_gpu_name = str(serials.get("GpuName") or gpu_name or "").strip()

                        def _is_generic_or_missing_gpu(pnp, name):
                            pnp_str = str(pnp or "").lower()
                            name_str = str(name or "").lower()
                            
                            if "root\\basicdisplay" in pnp_str:
                                return True
                            if ("microsoft basic" in name_str
                                or "basic display" in name_str
                                or "standard vga" in name_str
                                or "remote display" in name_str):
                                return True
                            if pnp_str in ("unknown", "none", "") and name_str in ("unknown", "none", ""):
                                return True
                            return False

                        base_has_physical_gpu = not _is_generic_or_missing_gpu(base_gpu_pnp, base_gpu_name)
                        curr_is_missing_or_generic = _is_generic_or_missing_gpu(curr_gpu_pnp, curr_gpu_name)

                        if base_has_physical_gpu:
                            if curr_is_missing_or_generic:
                                # Jika masih dalam masa pemanasan 60 detik, abaikan (driver masih loading)
                                if not in_grace:
                                    display_prev = base_gpu_name if (base_gpu_name and base_gpu_name != "Unknown") else base_gpu_pnp
                                    mismatch_reasons.append(f"GPU/VGA fisik dicopot atau hilang (sebelumnya '{display_prev}')")
                            else:
                                # Kartu fisik ada, verifikasi Hardware PNP ID atau nama model
                                if base_gpu_pnp != "Unknown" and curr_gpu_pnp != "Unknown" and base_gpu_pnp != curr_gpu_pnp:
                                    mismatch_reasons.append("GPU/VGA ditukar (PNP Device ID berbeda)")
                                elif (
                                    base_gpu_name
                                    and curr_gpu_name
                                    and curr_gpu_name.lower() not in ("unknown", "none", "")
                                    and base_gpu_name.lower() not in ("unknown", "none", "")
                                    and base_gpu_name.lower() != curr_gpu_name.lower()
                                ):
                                    if base_gpu_pnp != "Unknown" and curr_gpu_pnp != "Unknown" and base_gpu_pnp == curr_gpu_pnp:
                                        # PNP ID fisik sama persis (kartu fisik tidak ditukar)
                                        pass
                                    elif not in_grace:
                                        mismatch_reasons.append(f"Model GPU berubah (dari '{base_gpu_name}' ke '{curr_gpu_name}')")

                        # D. RAM Serials
                        base_rams = set(baseline.get("RamSerials") or [])
                        curr_rams = set(serials.get("RamSerials") or [])
                        if base_rams:
                            missing_rams = base_rams - curr_rams
                            added_rams = curr_rams - base_rams
                            if missing_rams:
                                if not in_grace or len(curr_rams) > 0:
                                    mismatch_reasons.append(f"{len(missing_rams)} keping RAM dicopot/hilang")
                            elif added_rams:
                                mismatch_reasons.append("Terdeteksi keping RAM baru terpasang")

                        # E. Disk Serials
                        base_disks = set(baseline.get("DiskSerials") or [])
                        curr_disks = set(serials.get("DiskSerials") or [])
                        if base_disks:
                            missing_disks = base_disks - curr_disks
                            if missing_disks:
                                if not in_grace or len(curr_disks) > 0:
                                    mismatch_reasons.append("Penyimpanan (SSD/HDD) dicopot/hilang")

                        if mismatch_reasons:
                            # Alarm hanya di-trigger dan ditulis ke log jika sebelumnya belum mismatch
                            if not hardware.hardware_mismatch:
                                curr_now = now_utc()
                                hardware.hardware_mismatch = True
                                hardware.hardware_mismatch_time = curr_now
                                hardware.hardware_mismatch_desc = "; ".join(mismatch_reasons)

                                try:
                                    from app.models import PCUptimeLog
                                    prev_log = PCUptimeLog.query.filter(
                                        PCUptimeLog.pc_id == pc.id,
                                        PCUptimeLog.last_seen < curr_now.replace(tzinfo=None) - timedelta(minutes=2)
                                    ).order_by(PCUptimeLog.last_seen.desc()).first()
                                    last_shutdown = prev_log.last_seen if (prev_log and prev_log.last_seen) else (curr_now - timedelta(hours=8))
                                    hardware.hardware_cctv_window = HardwareService.format_cctv_internal_window(last_shutdown, curr_now)
                                except Exception:
                                    hardware.hardware_cctv_window = HardwareService.format_cctv_internal_window(curr_now - timedelta(hours=8), curr_now)

                                write_log("HARDWARE_ALERT", f"PC {pc.kode} terdeteksi mismatch: {hardware.hardware_mismatch_desc} ({hardware.hardware_cctv_window})")
                                needs_commit = True
                        else:
                            # Jika kondisi hardware kembali normal, clear status mismatch
                            if hardware.hardware_mismatch:
                                hardware.hardware_mismatch = False
                                hardware.hardware_mismatch_desc = None
                                hardware.hardware_mismatch_time = None
                                hardware.hardware_cctv_window = None
                                hardware.hardware_last_sync = now_utc()
                                needs_commit = True

            # 9. Simpan snapshot terbaru ke HardwareMetricsStore (In-Memory RAM)
            HardwareMetricsStore.set(pc.id, {
                "cpu_usage": cpu_usage,
                "cpu_temp": cpu_temp,
                "gpu_temp": gpu_temp,
                "total_ram": total_ram,
                "nic_speed": nic_speed,
                "motherboard": motherboard,
                "cpu_name": cpu_name,
                "gpu_name": gpu_name,
                "active_window": active_window,
                "hardware_mismatch": bool(hardware.hardware_mismatch),
                "hardware_mismatch_desc": hardware.hardware_mismatch_desc
            })

            # 10. Commit ke SQLite HANYA jika ada status keamanan yang berubah (Zero Disk I/O normal)
            if needs_commit:
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
        cpu_temp = telemetry_data.get("cpu_temp", 0)
        gpu_temp = telemetry_data.get("gpu_temp", 0)

        # 1. Warning Suhu Tinggi (Immediate Alert)
        if cpu_temp >= 85:
            warnings.append(f"CPU Overheat ({cpu_temp}°C)")
        if gpu_temp >= 85:
            warnings.append(f"GPU Overheat ({gpu_temp}°C)")

        # 2. Warning Beban Kerja Tinggi (Sustained Load >= 3 snapshots berturut-turut)
        history = TelemetryHistoryStore.get(pc_id)
        if len(history) >= 3:
            all_cpu_high = all(h.get("cpu_usage", 0) >= 90 for h in history)
            all_ram_high = all(h.get("ram_usage_pct", 0) >= 90 for h in history)

            if all_cpu_high:
                warnings.append("CPU High Usage (>90%)")
            if all_ram_high:
                warnings.append("RAM High Usage (>90%)")

        if warnings:
            return {"status": "danger", "message": "; ".join(warnings)}

        # Cek status normal
        return {"status": "normal", "message": "Optimal"}

    @staticmethod
    def get_processes_by_pc(pc_id):
        """Mengambil data proses untuk satu PC dalam format list dict dari RAM store."""
        processes = ProcessRepository.get_by_pc(pc_id)
        return [p.to_dict() if hasattr(p, "to_dict") else p for p in processes]

    @staticmethod
    def delete_hardware(hardware_id, operator="system"):
        """Menghapus data hardware monitor berdasarkan ID dan melakukan commit database."""
        try:
            m = HardwareRepository.get_by_id(hardware_id)
            if not m:
                raise ValueError("Data hardware monitor tidak ditemukan")
                
            pc_kode = m.pc.kode if m.pc else "Unknown"
            HardwareMetricsStore.remove(m.pc_id)
            HardwareRepository.delete(m)
            db.session.commit()
            
            write_log("HAPUS_MONITOR", f"Data hardware monitor PC {pc_kode} dihapus manual oleh kasir", user=operator)
            return pc_kode
        except Exception as e:
            HardwareRepository.rollback()
            raise e

    @staticmethod
    def update_pc_baseline(pc_id, operator="admin"):
        """Mengambil data current specs dari telemetry terakhir dan menyimpannya sebagai baseline resmi."""
        try:
            hardware = HardwareRepository.get_by_pc_id(pc_id)
            if not hardware:
                raise ValueError("Data hardware monitor tidak ditemukan")
                
            if not hardware.hardware_current_specs:
                raise ValueError("Belum ada data telemetry yang masuk dari PC ini untuk dijadikan baseline")
                
            # Copy current specs ke baseline
            hardware.hardware_baseline = hardware.hardware_current_specs
            hardware.hardware_mismatch = False
            hardware.hardware_mismatch_desc = None
            hardware.hardware_mismatch_time = None
            hardware.hardware_cctv_window = None
            hardware.hardware_last_sync = now_utc()
            
            db.session.commit()
            
            pc_kode = hardware.pc.kode if hardware.pc else "Unknown"
            write_log("UPDATE_BASELINE", f"Baseline hardware PC {pc_kode} berhasil diperbarui oleh kasir/owner", user=operator)
            return pc_kode
        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def format_cctv_internal_window(start_dt, end_dt):
        """Format rentang waktu estimasi kejadian saat PC dalam kondisi mati sebelum booting."""
        if not end_dt:
            return "-"
            
        if not start_dt:
            start_dt = end_dt - timedelta(hours=8)
            
        start_local = display_in_tz(start_dt)
        end_local = display_in_tz(end_dt)
        tz_label = get_tz_short_name()
        
        if start_local.date() == end_local.date():
            return f"{start_local.strftime('%d/%m/%Y %H:%M')} {tz_label} s/d {end_local.strftime('%H:%M')} {tz_label} (rentang PC mati sebelum boot)"
        else:
            return f"{start_local.strftime('%d/%m/%Y %H:%M')} {tz_label} s/d {end_local.strftime('%d/%m/%Y %H:%M')} {tz_label} (rentang PC mati sebelum boot)"
