# tools/seed_maintenance_and_uptime.py
"""Seed data komprehensif untuk Perawatan PC (Maintenance) dan Pelacak Uptime PC.

Script ini mengisi tabel:
1. MaintenanceTicket (tiket kerusakan/perawatan PC, kategori hardware/software/jaringan, status, dan biaya)
2. PCUptimeLog (statistik uptime, total detik online, detik billing, utilisasi untuk 7 hari terakhir per PC)

Usage:
    python tools/seed_maintenance_and_uptime.py
"""

import sys
import os
import random
from datetime import date, datetime, timedelta, timezone

# Tambahkan root path ke sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app
from app.models import db, now_local, PC, Grup, HardwareMonitor, MaintenanceTicket, PCUptimeLog

def seed():
    app = create_app()
    with app.app_context():
        print("[SEED] Memulai seeding Perawatan PC & Pelacak Uptime...")

        pcs = PC.query.all()
        if not pcs:
            print("[WARN] Belum ada unit PC di database. Silakan jalankan 'python seed.py' terlebih dahulu.")
            return

        # 1. Seeding Tiket Perawatan PC (MaintenanceTicket)
        print(f"[ADD] Menambahkan tiket perawatan PC untuk {len(pcs)} unit PC...")
        MaintenanceTicket.query.delete()

        ticket_scenarios = [
            {
                "kategori": "HARDWARE",
                "prioritas": "SEDANG",
                "judul": "Penggantian Fan Casing Bunyi Berisik",
                "deskripsi": "Fan intake bagian depan mengeluarkan bunyi decit saat putaran tinggi.",
                "status": "SELESAI",
                "resolusi": "Ganti fan 120mm RGB baru & pelumasan bearing fan exhaust.",
                "biaya": 75000,
                "reporter": "kasir",
                "resolved_by": "admin",
                "days_ago": 3
            },
            {
                "kategori": "HARDWARE",
                "prioritas": "TINGGI",
                "judul": "Thermal Paste Re-pasting CPU & GPU",
                "deskripsi": "Suhu CPU melonjak hingga 84C saat bermain Cyberpunk 2077.",
                "status": "SELESAI",
                "resolusi": "Aplikasi ulang thermal paste Noctua NT-H1 & bersihkan heatsink.",
                "biaya": 50000,
                "reporter": "admin",
                "resolved_by": "admin",
                "days_ago": 5
            },
            {
                "kategori": "SOFTWARE",
                "prioritas": "SEDANG",
                "judul": "Update Driver VGA & Windows Update",
                "deskripsi": "Driver GPU lama menyebabkan stuttering pada game Apex Legends.",
                "status": "DIPROSES",
                "resolusi": "Sedang proses DDU clean install driver NVIDIA Game Ready terbaru.",
                "biaya": 0,
                "reporter": "kasir",
                "resolved_by": "admin",
                "days_ago": 1
            },
            {
                "kategori": "JARINGAN",
                "prioritas": "KRITIS",
                "judul": "Kabel LAN Drop Speed ke 100 Mbps",
                "deskripsi": "Koneksi LAN sering drop ke 100 Mbps, menyebabkan ping spike.",
                "status": "SELESAI",
                "resolusi": "Crimping ulang konektor RJ45 Cat6 & tes gigabit 1 Gbps stabil.",
                "biaya": 25000,
                "reporter": "kasir",
                "resolved_by": "admin",
                "days_ago": 4
            },
            {
                "kategori": "HARDWARE",
                "prioritas": "SEDANG",
                "judul": "Tombol Mechanical Switch Keyboard Double-click",
                "deskripsi": "Tombol 'D' dan 'Space' sering double tap saat digunakan main Valorant.",
                "status": "BARU",
                "resolusi": None,
                "biaya": 0,
                "reporter": "kasir",
                "resolved_by": None,
                "days_ago": 0
            },
            {
                "kategori": "HARDWARE",
                "prioritas": "RENDAH",
                "judul": "Pembersihan Busa & Earpad Headset Gaming",
                "deskripsi": "Perawatan berkala sanitasi earpad dan cek mic headset.",
                "status": "SELESAI",
                "resolusi": "Sanitasi dengan cairan pembersih khusus & tes audio mic normal.",
                "biaya": 15000,
                "reporter": "admin",
                "resolved_by": "admin",
                "days_ago": 6
            },
            {
                "kategori": "SOFTWARE",
                "prioritas": "SEDANG",
                "judul": "Reinstall Game Valorant & Anti-cheat Vanguard",
                "deskripsi": "Vanguard error code VAN 9003 saat peluncuran game.",
                "status": "BARU",
                "resolusi": None,
                "biaya": 0,
                "reporter": "kasir",
                "resolved_by": None,
                "days_ago": 0
            }
        ]

        now = now_local()
        tickets = []
        for idx, pc in enumerate(pcs):
            sc = ticket_scenarios[idx % len(ticket_scenarios)]
            created_time = now - timedelta(days=sc["days_ago"], hours=random.randint(1, 8))
            resolved_time = (created_time + timedelta(hours=random.randint(2, 6))) if sc["status"] == "SELESAI" else None
            
            ticket = MaintenanceTicket(
                pc_id=pc.id,
                reporter=sc["reporter"],
                kategori=sc["kategori"],
                prioritas=sc["prioritas"],
                judul=f"{sc['judul']} ({pc.kode})",
                deskripsi=sc["deskripsi"],
                status=sc["status"],
                resolusi=sc["resolusi"],
                biaya=sc["biaya"],
                created_at=created_time,
                updated_at=resolved_time or created_time,
                resolved_at=resolved_time,
                resolved_by=sc["resolved_by"]
            )
            tickets.append(ticket)

        db.session.add_all(tickets)
        db.session.commit()
        print(f"[OK] {len(tickets)} tiket perawatan PC berhasil ditambahkan!")

        # 2. Seeding Pelacak Uptime PC (PCUptimeLog untuk 7 hari terakhir)
        print(f"[ADD] Menambahkan log uptime 7 hari terakhir untuk {len(pcs)} unit PC...")
        PCUptimeLog.query.delete()

        today = date.today()
        uptime_logs = []

        for pc in pcs:
            for day_offset in range(7):
                target_date = today - timedelta(days=day_offset)
                
                # Simulasi online 10 - 16 jam per hari
                online_hours = random.uniform(10.0, 16.5)
                online_secs = int(online_hours * 3600)
                
                # Utilisasi billing 60% - 90% dari waktu online
                util_rate = random.uniform(0.60, 0.90)
                billing_secs = int(online_secs * util_rate)

                first_seen_dt = datetime.combine(target_date, datetime.min.time()) + timedelta(hours=random.randint(7, 9), minutes=random.randint(0, 59))
                last_seen_dt = first_seen_dt + timedelta(seconds=online_secs)

                log_entry = PCUptimeLog(
                    pc_id=pc.id,
                    tanggal=target_date,
                    total_online_seconds=online_secs,
                    total_billing_seconds=billing_secs,
                    first_seen=first_seen_dt,
                    last_seen=last_seen_dt
                )
                uptime_logs.append(log_entry)

        db.session.add_all(uptime_logs)
        db.session.commit()
        print(f"[OK] {len(uptime_logs)} data log uptime PC berhasil ditambahkan!")

        # 3. Pastikan HardwareMonitor Baseline Ada untuk semua PC
        print(f"[ADD] Sinkronisasi HardwareMonitor Baseline untuk semua unit PC...")
        for pc in pcs:
            hw = HardwareMonitor.query.filter_by(pc_id=pc.id).first()
            if not hw:
                hw = HardwareMonitor(
                    pc_id=pc.id,
                    cpu_temp=random.randint(42, 65),
                    gpu_temp=random.randint(45, 70),
                    cpu_usage=random.randint(10, 55),
                    total_ram="16 GB",
                    cpu_name="Intel Core i5-12400F",
                    gpu_name="NVIDIA GeForce RTX 3060",
                    motherboard="ASUS PRIME B660M",
                    nic_speed="1 Gbps",
                    active_window="Steam Client"
                )
                db.session.add(hw)

            # Buat baseline resmi
            if not hw.hardware_baseline:
                import json
                baseline_data = {
                    "MotherboardSerial": f"MB-{pc.kode}-SN{random.randint(1000, 9999)}",
                    "CpuId": f"CPUID-{pc.kode}-BFEBFBFF",
                    "GpuPnpId": "PCI\\VEN_10DE&DEV_2503&SUBSYS_306010DE",
                    "RamSerials": [f"RAM_{pc.kode}_A", f"RAM_{pc.kode}_B"],
                    "DiskSerials": [f"NVME_{pc.kode}_512GB"]
                }
                hw.hardware_baseline = json.dumps(baseline_data)
                hw.hardware_current_specs = json.dumps(baseline_data)
                hw.hardware_mismatch = False
                hw.hardware_mismatch_desc = None
                hw.hardware_last_sync = now_local()
                hw.last_update = now_local()

        db.session.commit()
        print("[OK] Hardware Monitor Baseline selesai disinkronkan!")

        print("\n[FINISH] Seeding Perawatan PC & Pelacak Uptime Selesai!")

if __name__ == "__main__":
    seed()
