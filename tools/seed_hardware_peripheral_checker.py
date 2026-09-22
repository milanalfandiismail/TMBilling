# tools/seed_hardware_peripheral_checker.py
"""Seed script untuk menguji fitur Hardware Checker & Peripheral Security (Always-On + CCTV Smart Reference).

Menghasilkan skenario:
1. PC01: Aman / Protected (Hardware & Periferal 100% Cocok).
2. PC02: Headset Tercuri / Dicabut > 5 Menit (CCTV Jam Pasti 23:55).
3. PC03: Headset Baru Saja Dicabut 2 Menit Lalu (Status Grace Period < 5m Amber).
4. PC04: Hardware Internal Ditukar (GPU / VGA Ditukar saat PC Mati, Rentang CCTV Shutdown-to-Boot).
5. PC05: Dual Alert (RAM 1 Keping Hilang + Mouse Dicabut).
"""

import sys
import os
import json
from datetime import datetime, timedelta

# Tambahkan root path ke sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app
from app.models import db, PC, Grup, HardwareMonitor
from app.services.hardware.hardware_service import HardwareService
from app.utils.timezone_utils import now_utc, format_display

def seed():
    app = create_app()
    with app.app_context():
        print("[SEED] Memulai seeding data Hardware & Peripheral Checker...")

        # 1. Pastikan grup ada
        grup_vip = Grup.query.filter_by(nama="vip").first()
        if not grup_vip:
            grup_vip = Grup(nama="vip", keterangan="Zona VIP", warna="#8b5cf6")
            db.session.add(grup_vip)

        grup_reg = Grup.query.filter_by(nama="reguler").first()
        if not grup_reg:
            grup_reg = Grup(nama="reguler", keterangan="Zona Reguler", warna="#3b82f6")
            db.session.add(grup_reg)

        db.session.commit()

        # Daftar skenario PC
        now = now_utc()
        six_mins_ago = now - timedelta(minutes=6)
        two_mins_ago = now - timedelta(minutes=2)

        pcs_data = [
            {
                "kode": "PC01",
                "nama": "PC VIP 01",
                "ip": "192.168.1.101",
                "mac": "00:1A:2B:3C:01:01",
                "grup": grup_vip,
                "cpu_name": "Intel Core i5-13400F",
                "gpu_name": "NVIDIA GeForce RTX 4060",
                "total_ram": "16 GB",
                "motherboard": "ASUS PRIME B760M-A",
                "baseline_serials": {
                    "MotherboardSerial": "MB-VIP01-8899",
                    "CpuId": "BFEBFBFF000B0671",
                    "GpuPnpId": "PCI\\VEN_10DE&DEV_2882&SUBSYS_406010DE",
                    "RamSerials": ["RAM_VIP1_8GB", "RAM_VIP2_8GB"],
                    "DiskSerials": ["Samsung SSD 980 500GB_S5GXNF0T01"]
                },
                "curr_serials": {
                    "MotherboardSerial": "MB-VIP01-8899",
                    "CpuId": "BFEBFBFF000B0671",
                    "GpuPnpId": "PCI\\VEN_10DE&DEV_2882&SUBSYS_406010DE",
                    "RamSerials": ["RAM_VIP1_8GB", "RAM_VIP2_8GB"],
                    "DiskSerials": ["Samsung SSD 980 500GB_S5GXNF0T01"]
                },
                "hw_mismatch": False,
                "hw_desc": None,
                "hw_time": None,
                "baseline_periph": {
                    "Mouse": "Razer DeathAdder Essential (USB)",
                    "Keyboard": "Logitech G213 Prodigy (USB)",
                    "Headset": "HyperX Cloud II Wireless (USB)"
                },
                "curr_periph": {
                    "Mouse": "Razer DeathAdder Essential (USB)",
                    "Keyboard": "Logitech G213 Prodigy (USB)",
                    "Headset": "HyperX Cloud II Wireless (USB)"
                },
                "periph_mismatch": False,
                "periph_desc": None,
                "periph_time": None,
                "periph_tracker": None
            },
            {
                "kode": "PC02",
                "nama": "PC VIP 02",
                "ip": "192.168.1.102",
                "mac": "00:1A:2B:3C:01:02",
                "grup": grup_vip,
                "cpu_name": "Intel Core i5-13400F",
                "gpu_name": "NVIDIA GeForce RTX 4060",
                "total_ram": "16 GB",
                "motherboard": "ASUS PRIME B760M-A",
                "baseline_serials": {
                    "MotherboardSerial": "MB-VIP02-7788",
                    "CpuId": "BFEBFBFF000B0671",
                    "GpuPnpId": "PCI\\VEN_10DE&DEV_2882&SUBSYS_406010DE",
                    "RamSerials": ["RAM_VIP3_8GB", "RAM_VIP4_8GB"],
                    "DiskSerials": ["Samsung SSD 980 500GB_S5GXNF0T02"]
                },
                "curr_serials": {
                    "MotherboardSerial": "MB-VIP02-7788",
                    "CpuId": "BFEBFBFF000B0671",
                    "GpuPnpId": "PCI\\VEN_10DE&DEV_2882&SUBSYS_406010DE",
                    "RamSerials": ["RAM_VIP3_8GB", "RAM_VIP4_8GB"],
                    "DiskSerials": ["Samsung SSD 980 500GB_S5GXNF0T02"]
                },
                "hw_mismatch": False,
                "hw_desc": None,
                "hw_time": None,
                "baseline_periph": {
                    "Mouse": "Razer DeathAdder Essential (USB)",
                    "Keyboard": "Logitech G213 Prodigy (USB)",
                    "Headset": "HyperX Cloud II Wireless (USB)"
                },
                "curr_periph": {
                    "Mouse": "Razer DeathAdder Essential (USB)",
                    "Keyboard": "Logitech G213 Prodigy (USB)",
                    "Headset": "Unknown" # Dicabut > 5 menit!
                },
                "periph_mismatch": True,
                "periph_desc": f"Headset dicabut pukul {format_display(six_mins_ago, fmt='%H:%M')} (> 5 menit lalu). Cek aktivitas CCTV jam {format_display(six_mins_ago, fmt='%H:%M')}",
                "periph_time": six_mins_ago,
                "periph_tracker": json.dumps({
                    "Headset": {
                        "disconnected_at": six_mins_ago.isoformat(),
                        "baseline": "HyperX Cloud II Wireless (USB)"
                    }
                })
            },
            {
                "kode": "PC03",
                "nama": "PC 03 (Reguler)",
                "ip": "192.168.1.103",
                "mac": "00:1A:2B:3C:01:03",
                "grup": grup_reg,
                "cpu_name": "Intel Core i3-12100F",
                "gpu_name": "NVIDIA GeForce GTX 1660 Super",
                "total_ram": "16 GB",
                "motherboard": "ASRock H610M-HVS",
                "baseline_serials": {
                    "MotherboardSerial": "MB-REG03-1122",
                    "CpuId": "BFEBFBFF00090674",
                    "GpuPnpId": "PCI\\VEN_10DE&DEV_21C4&SUBSYS_166010DE",
                    "RamSerials": ["RAM_REG1_8GB", "RAM_REG2_8GB"],
                    "DiskSerials": ["Kingston NV2 500GB_KNV2003"]
                },
                "curr_serials": {
                    "MotherboardSerial": "MB-REG03-1122",
                    "CpuId": "BFEBFBFF00090674",
                    "GpuPnpId": "PCI\\VEN_10DE&DEV_21C4&SUBSYS_166010DE",
                    "RamSerials": ["RAM_REG1_8GB", "RAM_REG2_8GB"],
                    "DiskSerials": ["Kingston NV2 500GB_KNV2003"]
                },
                "hw_mismatch": False,
                "hw_desc": None,
                "hw_time": None,
                "baseline_periph": {
                    "Mouse": "Fantech VX7 Crypto (USB)",
                    "Keyboard": "Fantech K613 Fighter (USB)",
                    "Headset": "Fantech HG11 Captain 7.1 (USB)"
                },
                "curr_periph": {
                    "Mouse": "Fantech VX7 Crypto (USB)",
                    "Keyboard": "Fantech K613 Fighter (USB)",
                    "Headset": "Unknown" # Baru dicabut 2 menit lalu
                },
                "periph_mismatch": False, # Belum 5 menit, jadi belum alarm merah
                "periph_desc": None,
                "periph_time": None,
                "periph_tracker": json.dumps({
                    "Headset": {
                        "disconnected_at": two_mins_ago.isoformat(),
                        "baseline": "Fantech HG11 Captain 7.1 (USB)"
                    }
                })
            },
            {
                "kode": "PC04",
                "nama": "PC 04 (Reguler)",
                "ip": "192.168.1.104",
                "mac": "00:1A:2B:3C:01:04",
                "grup": grup_reg,
                "cpu_name": "Intel Core i3-12100F",
                "gpu_name": "Intel UHD Graphics 730 (GPU Hilang)",
                "total_ram": "16 GB",
                "motherboard": "ASRock H610M-HVS",
                "baseline_serials": {
                    "MotherboardSerial": "MB-REG04-3344",
                    "CpuId": "BFEBFBFF00090674",
                    "GpuPnpId": "PCI\\VEN_10DE&DEV_21C4&SUBSYS_166010DE",
                    "RamSerials": ["RAM_REG3_8GB", "RAM_REG4_8GB"],
                    "DiskSerials": ["Kingston NV2 500GB_KNV2004"]
                },
                "curr_serials": {
                    "MotherboardSerial": "MB-REG04-3344",
                    "CpuId": "BFEBFBFF00090674",
                    "GpuPnpId": "PCI\\VEN_8086&DEV_4692&SUBSYS_00008086", # Ditukar ke iGPU!
                    "RamSerials": ["RAM_REG3_8GB", "RAM_REG4_8GB"],
                    "DiskSerials": ["Kingston NV2 500GB_KNV2004"]
                },
                "hw_mismatch": True,
                "hw_desc": "GPU/VGA ditukar (PNP Device ID berbeda). Cek CCTV dari rentang waktu PC mati sebelum booting.",
                "hw_time": now - timedelta(hours=8),
                "hw_cctv_window": HardwareService.format_cctv_internal_window(now - timedelta(hours=8), now),
                "baseline_periph": {
                    "Mouse": "Fantech VX7 Crypto (USB)",
                    "Keyboard": "Fantech K613 Fighter (USB)",
                    "Headset": "Fantech HG11 Captain 7.1 (USB)"
                },
                "curr_periph": {
                    "Mouse": "Fantech VX7 Crypto (USB)",
                    "Keyboard": "Fantech K613 Fighter (USB)",
                    "Headset": "Fantech HG11 Captain 7.1 (USB)"
                },
                "periph_mismatch": False,
                "periph_desc": None,
                "periph_time": None,
                "periph_tracker": None
            }
        ]

        for p_info in pcs_data:
            pc = PC.query.filter_by(kode=p_info["kode"]).first()
            if not pc:
                pc = PC(
                    kode=p_info["kode"],
                    nama=p_info["nama"],
                    ip_address=p_info["ip"],
                    mac_address=p_info["mac"],
                    grup_id=p_info["grup"].id,
                    aktif=True,
                    last_activity=now
                )
                db.session.add(pc)
                db.session.flush()
            else:
                pc.nama = p_info["nama"]
                pc.ip_address = p_info["ip"]
                pc.mac_address = p_info["mac"]
                pc.grup_id = p_info["grup"].id
                pc.last_activity = now

            hw = HardwareMonitor.query.filter_by(pc_id=pc.id).first()
            if not hw:
                hw = HardwareMonitor(pc_id=pc.id)
                db.session.add(hw)

            hw.cpu_name = p_info["cpu_name"]
            hw.gpu_name = p_info["gpu_name"]
            hw.total_ram = p_info["total_ram"]
            hw.motherboard = p_info["motherboard"]
            hw.nic_speed = "1.0 Gbps"
            hw.cpu_usage = 15.0
            hw.cpu_temp = 45.0
            hw.gpu_temp = 50.0

            hw.hardware_baseline = json.dumps(p_info["baseline_serials"])
            hw.hardware_current_specs = json.dumps(p_info["curr_serials"])
            hw.hardware_mismatch = p_info["hw_mismatch"]
            hw.hardware_mismatch_desc = p_info["hw_desc"]
            hw.hardware_mismatch_time = p_info["hw_time"]
            hw.hardware_cctv_window = p_info.get("hw_cctv_window")
            hw.hardware_last_sync = now

            hw.peripherals_baseline = json.dumps(p_info["baseline_periph"])
            hw.peripherals_current = json.dumps(p_info["curr_periph"])
            hw.peripherals_mismatch = p_info["periph_mismatch"]
            hw.peripherals_mismatch_desc = p_info["periph_desc"]
            hw.peripherals_mismatch_time = p_info["periph_time"]
            hw.peripherals_disconnect_tracker = p_info["periph_tracker"]

        # Update legacy mismatched records without hardware_cctv_window
        legacy_mismatches = HardwareMonitor.query.filter(
            HardwareMonitor.hardware_mismatch == True,
            HardwareMonitor.hardware_cctv_window.is_(None)
        ).all()
        for leg_hw in legacy_mismatches:
            event_time = leg_hw.hardware_mismatch_time or now
            leg_hw.hardware_cctv_window = HardwareService.format_cctv_internal_window(
                event_time - timedelta(hours=8),
                event_time
            )

        db.session.commit()
        print("[SUCCESS] Data seed untuk 4 skenario Hardware & Peripheral Checker berhasil diisi!")
        print("1. PC01: Aman (Semua Cocok)")
        print("2. PC02: Headset Tercuri (> 5m) dengan CCTV Ref")
        print("3. PC03: Headset Grace Period (< 5m Amber)")
        print("4. PC04: Internal Hardware Mismatch (GPU Swapped)")

if __name__ == "__main__":
    seed()
