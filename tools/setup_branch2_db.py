"""Skrip inisialisasi, migrasi database, dan seeding data untuk Cabang Kedua (branch2.db).

Menghasilkan database lengkap yang terisolasi dengan data PC, Grup, Paket,
Kantin, Member, dan Pengaturan yang berbeda dari server utama.
"""

import sys
import os
import json

# Set environment variable agar menggunakan branch2.db
os.environ["DATABASE_URL"] = "sqlite:///branch2.db"

# Tambahkan root path ke sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from flask_migrate import upgrade
from app import create_app
from app.models import db, User, PC, Grup, Paket, MenuItem, Member, Settings, HardwareMonitor
from app.utils.timezone_utils import now_utc

def setup_and_seed_branch2():
    print("=" * 65)
    print("[SETUP] MEMULAI SETUP & SEEDING DATABASE CABANG KEDUA (branch2.db)")
    print("=" * 65)

    # 1. Inisialisasi App dengan branch2.db
    app = create_app()
    with app.app_context():
        # 2. Pastikan seluruh tabel ter-generate
        db.create_all()

        # 3. Akun Pengguna (Admin & Kasir)
        print("[INFO] Membuat akun pengguna...")
        admin = User.query.filter_by(username="admin").first()
        if not admin:
            admin = User(username="admin", role="admin", nama_lengkap="Admin Cabang Selatan", aktif=True)
            admin.set_password("admin123")
            db.session.add(admin)
        else:
            admin.nama_lengkap = "Admin Cabang Selatan"
            admin.set_password("admin123")

        kasir = User.query.filter_by(username="kasir").first()
        if not kasir:
            kasir = User(username="kasir", role="kasir", nama_lengkap="Kasir Rian", aktif=True)
            kasir.set_password("kasir123")
            db.session.add(kasir)

        # 4. Pengaturan Identitas Cabang & API Keys
        print("[INFO] Mengonfigurasi identitas cabang & API Key...")
        settings_data = {
            "warnet_name": "TMBilling Cyber Arena (Cabang Selatan)",
            "warnet_title": "Cyber Arena Selatan",
            "warnet_address": "Jl. Boulevard Selatan No. 88, Kawasan E-Sport",
            "warnet_phone": "0812-9988-7766",
            "warnet_announcement": "Selamat datang di Cyber Arena Selatan! Area Gaming 240Hz, Kursi Ergonomis, & Full AC.",
            "branch_api_key": "TM-BRANCH2-KEY-SECURE-9988776655",
            "client_api_key": "TM2026QWERTY-api-key",
            "polling_interval": "1000",
            "auto_backup_unit": "menit",
            "auto_backup_value": "60"
        }
        for k, v in settings_data.items():
            setting = Settings.query.filter_by(key=k).first()
            if not setting:
                db.session.add(Settings(key=k, value=str(v)))
            else:
                setting.value = str(v)

        db.session.commit()

        # 5. Grup / Zona PC
        print("[INFO] Membuat grup PC (Zona)...")
        grup_sultan = Grup.query.filter_by(nama="vip sultan").first()
        if not grup_sultan:
            grup_sultan = Grup(nama="vip sultan", keterangan="Private Room Dual Monitor & RTX 4070 Ti", warna="#8b5cf6")
            db.session.add(grup_sultan)
            db.session.commit()

        grup_esport = Grup.query.filter_by(nama="e-sport arena").first()
        if not grup_esport:
            grup_esport = Grup(nama="e-sport arena", keterangan="Area Turnamen 240Hz Ryzen 7", warna="#10b981")
            db.session.add(grup_esport)
            db.session.commit()

        grup_reguler = Grup.query.filter_by(nama="reguler gaming").first()
        if not grup_reguler:
            grup_reguler = Grup(nama="reguler gaming", keterangan="Area Reguler Nyaman", warna="#3b82f6")
            db.session.add(grup_reguler)
            db.session.commit()

        # 6. Daftar Unit PC & Denah
        print("[INFO] Membuat unit PC dan denah layout...")
        pcs = [
            {
                "kode": "PC-01",
                "nama": "Sultan 01",
                "ip": "192.168.2.101",
                "mac": "00:50:56:C0:02:01",
                "grup": grup_sultan,
                "pos_x": 60,
                "pos_y": 80,
                "cpu": "Intel Core i7-14700K",
                "gpu": "NVIDIA GeForce RTX 4070 Ti",
                "ram": "32 GB DDR5",
                "mobo": "ASUS ROG STRIX Z790-E",
                "mobo_sn": "MB-SLT01-998811"
            },
            {
                "kode": "PC-02",
                "nama": "Sultan 02",
                "ip": "192.168.2.102",
                "mac": "00:50:56:C0:02:02",
                "grup": grup_sultan,
                "pos_x": 200,
                "pos_y": 80,
                "cpu": "Intel Core i7-14700K",
                "gpu": "NVIDIA GeForce RTX 4070 Ti",
                "ram": "32 GB DDR5",
                "mobo": "ASUS ROG STRIX Z790-E",
                "mobo_sn": "MB-SLT02-998822"
            },
            {
                "kode": "PC-03",
                "nama": "Arena 03",
                "ip": "192.168.2.103",
                "mac": "00:50:56:C0:02:03",
                "grup": grup_esport,
                "pos_x": 60,
                "pos_y": 220,
                "cpu": "AMD Ryzen 7 7800X3D",
                "gpu": "NVIDIA GeForce RTX 4060 Ti",
                "ram": "32 GB DDR5",
                "mobo": "MSI MAG B650 TOMAHAWK",
                "mobo_sn": "MB-ARN03-774433"
            },
            {
                "kode": "PC-04",
                "nama": "Arena 04",
                "ip": "192.168.2.104",
                "mac": "00:50:56:C0:02:04",
                "grup": grup_esport,
                "pos_x": 200,
                "pos_y": 220,
                "cpu": "AMD Ryzen 7 7800X3D",
                "gpu": "NVIDIA GeForce RTX 4060 Ti",
                "ram": "32 GB DDR5",
                "mobo": "MSI MAG B650 TOMAHAWK",
                "mobo_sn": "MB-ARN04-774444"
            },
            {
                "kode": "PC-05",
                "nama": "Gaming 05",
                "ip": "192.168.2.105",
                "mac": "00:50:56:C0:02:05",
                "grup": grup_reguler,
                "pos_x": 340,
                "pos_y": 80,
                "cpu": "Intel Core i5-13400F",
                "gpu": "NVIDIA GeForce RTX 3060",
                "ram": "16 GB DDR4",
                "mobo": "ASUS PRIME B760M-A",
                "mobo_sn": "MB-REG05-552211"
            },
            {
                "kode": "PC-06",
                "nama": "Gaming 06",
                "ip": "192.168.2.106",
                "mac": "00:50:56:C0:02:06",
                "grup": grup_reguler,
                "pos_x": 340,
                "pos_y": 220,
                "cpu": "Intel Core i5-13400F",
                "gpu": "NVIDIA GeForce RTX 3060",
                "ram": "16 GB DDR4",
                "mobo": "ASUS PRIME B760M-A",
                "mobo_sn": "MB-REG06-552222"
            }
        ]

        for p in pcs:
            pc_obj = PC.query.filter_by(kode=p["kode"]).first()
            if not pc_obj:
                pc_obj = PC(
                    kode=p["kode"],
                    nama=p["nama"],
                    ip_address=p["ip"],
                    mac_address=p["mac"],
                    grup_id=p["grup"].id if p["grup"] else grup_reguler.id,
                    aktif=True,
                    pos_x=p["pos_x"],
                    pos_y=p["pos_y"]
                )
                db.session.add(pc_obj)
                db.session.flush()

                # Tambahkan hardware monitor
                hw = HardwareMonitor(
                    pc_id=pc_obj.id,
                    cpu_name=p["cpu"],
                    gpu_name=p["gpu"],
                    total_ram=p["ram"],
                    motherboard=p["mobo"],
                    cpu_usage=12.5,
                    cpu_temp=45.0,
                    gpu_temp=48.0,
                    nic_speed="1000 Mbps",
                    active_window="Desktop",
                    hardware_baseline=json.dumps({
                        "Motherboard": p["mobo"],
                        "MotherboardSerial": p["mobo_sn"],
                        "CpuId": "BFEBFBFF000B0671",
                        "GpuPnpId": "PCI\\VEN_10DE&DEV_4070",
                        "RamSerials": ["RAM_DDR5_16GB_1", "RAM_DDR5_16GB_2"],
                        "DiskSerials": ["NVME_SAMSUNG_980PRO_1TB"]
                    }),
                    hardware_current_specs=json.dumps({
                        "Motherboard": p["mobo"],
                        "MotherboardSerial": p["mobo_sn"],
                        "CpuId": "BFEBFBFF000B0671",
                        "GpuPnpId": "PCI\\VEN_10DE&DEV_4070",
                        "RamSerials": ["RAM_DDR5_16GB_1", "RAM_DDR5_16GB_2"],
                        "DiskSerials": ["NVME_SAMSUNG_980PRO_1TB"]
                    })
                )
                db.session.add(hw)

        db.session.commit()

        # 7. Paket Billing Khas Cabang
        print("[INFO] Membuat paket billing...")
        pakets = [
            {"nama": "Paket Sultan 3 Jam", "durasi": 180, "harga": 25000, "grup_id": grup_sultan.id},
            {"nama": "Paket Sultan Night 8 Jam", "durasi": 480, "harga": 60000, "grup_id": grup_sultan.id},
            {"nama": "Paket E-Sport 5 Jam", "durasi": 300, "harga": 30000, "grup_id": grup_esport.id},
            {"nama": "Paket Happy Hour 3 Jam", "durasi": 180, "harga": 15000, "grup_id": grup_reguler.id},
            {"nama": "Paket Reguler 1 Jam", "durasi": 60, "harga": 6000, "grup_id": grup_reguler.id}
        ]
        for pkt in pakets:
            p_obj = Paket.query.filter_by(nama=pkt["nama"]).first()
            if not p_obj:
                db.session.add(Paket(
                    nama=pkt["nama"],
                    durasi_menit=pkt["durasi"],
                    harga=pkt["harga"],
                    grup_id=pkt["grup_id"],
                    aktif=True
                ))
        db.session.commit()

        # 8. Menu Kantin / POS
        print("[INFO] Membuat menu kantin...")
        menus = [
            {"nama": "Indomie Goreng Sultan + Kornet Telur", "harga": 15000, "stok": 30},
            {"nama": "Nasi Goreng Spesial Cyber", "harga": 18000, "stok": 20},
            {"nama": "Kopi Susu Aren Gula Jawa", "harga": 10000, "stok": 50},
            {"nama": "Monster Energy Drink", "harga": 28000, "stok": 15},
            {"nama": "French Fries Truffle", "harga": 14000, "stok": 25}
        ]
        for m in menus:
            m_obj = MenuItem.query.filter_by(nama=m["nama"]).first()
            if not m_obj:
                db.session.add(MenuItem(
                    nama=m["nama"],
                    harga=m["harga"],
                    stok=m["stok"],
                    is_active=True
                ))
        db.session.commit()

        # 9. Data Member
        print("[INFO] Membuat data member...")
        members = [
            {"username": "sultan_gaming", "nama": "Kevin Sanjaya", "waktu": 300, "pin": "123456", "grup_id": grup_sultan.id},
            {"username": "esport_pro", "nama": "Faker Indonesia", "waktu": 180, "pin": "123456", "grup_id": grup_esport.id},
            {"username": "casual_player", "nama": "Budi Gaming", "waktu": 60, "pin": "123456", "grup_id": grup_reguler.id}
        ]
        for mem in members:
            mem_obj = Member.query.filter_by(username=mem["username"]).first()
            if not mem_obj:
                m_item = Member(
                    username=mem["username"],
                    nama_lengkap=mem["nama"],
                    grup_id=mem["grup_id"],
                    waktu_tersimpan=mem["waktu"],
                    aktif=True
                )
                m_item.set_password(mem["pin"])
                db.session.add(m_item)
        db.session.commit()

    print("=" * 65)
    print("[SUCCESS] Database Cabang Kedua (branch2.db) siap digunakan!")
    print("=" * 65)
    print("Detail Konfigurasi Cabang Kedua:")
    print("   * File Database  : branch2.db")
    print("   * Nama Cabang    : TMBilling Cyber Arena (Cabang Selatan)")
    print("   * Default Port   : 7016")
    print("   * URL Cabang     : http://127.0.0.1:7016")
    print("   * Branch API Key : TM-BRANCH2-KEY-SECURE-9988776655")
    print("   * Akun Login     : admin / admin123  (Kasir: kasir / kasir123)")
    print("   * Unit PC        : 6 PC (VIP Sultan, E-Sport Arena, Reguler)")
    print("=" * 65)

if __name__ == "__main__":
    setup_and_seed_branch2()
