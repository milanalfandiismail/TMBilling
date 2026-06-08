"""Script seeding data komprehensif untuk database TMBilling.

Script ini mengisi tabel Grup, User (Staff), PC, Paket, dan Member dengan
dataset yang besar (minimal 30 data per jenis) untuk keperluan pengujian
skala besar (stress testing), paginasi frontend, pencarian, dan visualisasi layout.

Skrip ini bersifat idempotent dan fresh (akan membersihkan data lama sebelum menulis).

Usage:
    python seed.py
"""

import sys
import random
from datetime import timedelta
from app import create_app
from app.models.base import db, now_local
from app.models.grup import Grup
from app.models.pc import PC
from app.models.paket import Paket
from app.models.member import Member
from app.models.user import User
from app.models.sesi import Sesi
from app.models.transaksi import Transaksi

# Buat instance aplikasi Flask agar kita bisa akses database
app = create_app()

def run_seed():
    """Menjalankan proses seeding data masif ke database."""
    with app.app_context():
        print("[INFO] Memulai proses seeding data komprehensif...")

        # 1. Bersihkan Data Lama Secara Terurut (Menjaga Foreign Key)
        print("[CLEAR] Membersihkan data lama agar fresh...")
        try:
            Transaksi.query.delete()
            Sesi.query.delete()
            Member.query.delete()
            PC.query.delete()
            Paket.query.delete()
            User.query.delete()
            Grup.query.delete()
            db.session.commit()
            print("[OK] Database berhasil dibersihkan!")
        except Exception as e:
            db.session.rollback()
            print(f"[ERROR] Gagal membersihkan database: {str(e)}")
            sys.exit(1)

        # 2. Seeding Grup (Warna Cyber Gaming Premium)
        print("[ADD] Menambahkan data Grup default...")
        grup_reg = Grup(nama="reguler", warna="#3b82f6", keterangan="Area standar non-smoking 60Hz")
        grup_vip = Grup(nama="vip", warna="#ec4899", keterangan="Area AC smoking, Gaming Gear Pro 144Hz")
        grup_vvip = Grup(nama="vvip", warna="#a855f7", keterangan="Ruangan private sultan 240Hz & PS5")
        
        db.session.add_all([grup_reg, grup_vip, grup_vvip])
        db.session.commit()
        print("[OK] Grup berhasil ditambahkan!")

        # Ambil id grup untuk referensi relasi
        grup_reg_id = grup_reg.id
        grup_vip_id = grup_vip.id
        grup_vvip_id = grup_vvip.id

        # 3. Seeding Staff User (Untuk Login Kasir/Admin)
        print("[ADD] Menambahkan data User staff default...")
        u_admin = User(username="admin", nama_lengkap="Administrator TMBilling", role="admin", aktif=True)
        u_admin.set_password("admin")

        u_kasir = User(username="kasir", nama_lengkap="Kasir Shift Siang", role="kasir", aktif=True)
        u_kasir.set_password("kasir")

        db.session.add_all([u_admin, u_kasir])
        db.session.commit()
        print("[OK] User staff berhasil ditambahkan! (admin:admin, kasir:kasir)")

        # 4. Seeding PC (Minimal 30 PC: 15 Reguler, 10 VIP, 5 VVIP)
        print("[ADD] Menambahkan 30 Unit PC...")
        pcs = []
        
        # 15 PC Reguler
        for i in range(1, 16):
            pc_code = f"PC-{i:02d}"
            pcs.append(PC(
                kode=pc_code,
                nama=f"Reguler Unit {i:02d}",
                grup_id=grup_reg_id,
                ip_address=f"192.168.1.1{i:02d}"
            ))

        # 10 PC VIP
        for i in range(1, 11):
            pc_code = f"VIP-{i:02d}"
            pcs.append(PC(
                kode=pc_code,
                nama=f"VIP Unit {i:02d}",
                grup_id=grup_vip_id,
                ip_address=f"192.168.1.2{i:02d}"
            ))

        # 5 PC VVIP
        for i in range(1, 6):
            pc_code = f"SULTAN-{i:02d}"
            pcs.append(PC(
                kode=pc_code,
                nama=f"VVIP Sultan {i:02d}",
                grup_id=grup_vvip_id,
                ip_address=f"192.168.1.3{i:02d}"
            ))

        db.session.add_all(pcs)
        db.session.commit()
        print(f"[OK] Selesai seeding {len(pcs)} unit PC!")

        # 5. Seeding Paket (Minimal 30 Paket)
        print("[ADD] Menambahkan 30 Variasi Paket Billing...")
        pakets = []

        # 12 Paket Reguler
        pakets.append(Paket(nama="Reguler - 1 Jam", grup_id=grup_reg_id, durasi_menit=60, harga=5000, kadaluarsa_hari=30))
        pakets.append(Paket(nama="Reguler - 2 Jam", grup_id=grup_reg_id, durasi_menit=120, harga=9000, kadaluarsa_hari=30))
        pakets.append(Paket(nama="Reguler - 3 Jam", grup_id=grup_reg_id, durasi_menit=180, harga=13000, kadaluarsa_hari=30))
        pakets.append(Paket(nama="Reguler - 4 Jam", grup_id=grup_reg_id, durasi_menit=240, harga=17000, kadaluarsa_hari=30))
        pakets.append(Paket(nama="Reguler - 5 Jam", grup_id=grup_reg_id, durasi_menit=300, harga=20000, kadaluarsa_hari=30))
        pakets.append(Paket(nama="Reguler - 6 Jam", grup_id=grup_reg_id, durasi_menit=360, harga=24000, kadaluarsa_hari=30))
        pakets.append(Paket(nama="Reguler - 8 Jam", grup_id=grup_reg_id, durasi_menit=480, harga=30000, kadaluarsa_hari=30))
        pakets.append(Paket(nama="Reguler - 10 Jam", grup_id=grup_reg_id, durasi_menit=600, harga=36000, kadaluarsa_hari=30))
        pakets.append(Paket(nama="Reguler - 12 Jam", grup_id=grup_reg_id, durasi_menit=720, harga=40000, kadaluarsa_hari=30))
        pakets.append(Paket(nama="Reguler Begadang (Malam)", grup_id=grup_reg_id, durasi_menit=480, harga=15000, kadaluarsa_hari=1))
        pakets.append(Paket(nama="Reguler Puas (24 Jam)", grup_id=grup_reg_id, durasi_menit=1440, harga=75000, kadaluarsa_hari=7))
        pakets.append(Paket(nama="Reguler Hemat Mingguan", grup_id=grup_reg_id, durasi_menit=3000, harga=140000, kadaluarsa_hari=7))

        # 10 Paket VIP
        pakets.append(Paket(nama="VIP - 1 Jam", grup_id=grup_vip_id, durasi_menit=60, harga=8000, kadaluarsa_hari=30))
        pakets.append(Paket(nama="VIP - 2 Jam", grup_id=grup_vip_id, durasi_menit=120, harga=15000, kadaluarsa_hari=30))
        pakets.append(Paket(nama="VIP - 3 Jam", grup_id=grup_vip_id, durasi_menit=180, harga=21000, kadaluarsa_hari=30))
        pakets.append(Paket(nama="VIP - 5 Jam", grup_id=grup_vip_id, durasi_menit=300, harga=32000, kadaluarsa_hari=30))
        pakets.append(Paket(nama="VIP - 8 Jam", grup_id=grup_vip_id, durasi_menit=480, harga=50000, kadaluarsa_hari=30))
        pakets.append(Paket(nama="VIP - 10 Jam", grup_id=grup_vip_id, durasi_menit=600, harga=60000, kadaluarsa_hari=30))
        pakets.append(Paket(nama="VIP Begadang (Malam)", grup_id=grup_vip_id, durasi_menit=600, harga=35000, kadaluarsa_hari=1))
        pakets.append(Paket(nama="VIP Sore Santai", grup_id=grup_vip_id, durasi_menit=240, harga=20000, kadaluarsa_hari=1))
        pakets.append(Paket(nama="VIP Sultan Muda", grup_id=grup_vip_id, durasi_menit=1200, harga=100000, kadaluarsa_hari=14))
        pakets.append(Paket(nama="VIP Happy Hour (Pagi)", grup_id=grup_vip_id, durasi_menit=180, harga=10000, kadaluarsa_hari=1))

        # 8 Paket VVIP
        pakets.append(Paket(nama="VVIP Sultan - 1 Jam", grup_id=grup_vvip_id, durasi_menit=60, harga=15000, kadaluarsa_hari=15))
        pakets.append(Paket(nama="VVIP Sultan - 3 Jam", grup_id=grup_vvip_id, durasi_menit=180, harga=40000, kadaluarsa_hari=15))
        pakets.append(Paket(nama="VVIP Sultan - 5 Jam", grup_id=grup_vvip_id, durasi_menit=300, harga=60000, kadaluarsa_hari=15))
        pakets.append(Paket(nama="VVIP Sultan - 10 Jam", grup_id=grup_vvip_id, durasi_menit=600, harga=110000, kadaluarsa_hari=15))
        pakets.append(Paket(nama="VVIP Begadang Mewah", grup_id=grup_vvip_id, durasi_menit=600, harga=75000, kadaluarsa_hari=1))
        pakets.append(Paket(nama="VVIP Full Day Streaming", grup_id=grup_vvip_id, durasi_menit=1440, harga=200000, kadaluarsa_hari=5))
        pakets.append(Paket(nama="VVIP Custom Event", grup_id=grup_vvip_id, durasi_menit=720, harga=150000, kadaluarsa_hari=3))
        pakets.append(Paket(nama="VVIP Sultan Party (3 Hari)", grup_id=grup_vvip_id, durasi_menit=4320, harga=500000, kadaluarsa_hari=3))

        db.session.add_all(pakets)
        db.session.commit()
        print(f"[OK] Selesai seeding {len(pakets)} variasi Paket!")

        # 6. Seeding Member (Minimal 35 Member untuk Paginasi & Stress Test)
        print("[ADD] Menambahkan 35 Member dengan karakter Dota/Gaming...")
        member_names = [
            # (username, nama_lengkap, grup_id, waktu_menit, status_aktif, days_to_expiry_offset)
            ("gaming_sultan", "Raffi Ahmad Gaming", grup_vvip_id, 4320, True, 15),
            ("warnet_legend", "Legenda Sempurna", grup_reg_id, 1200, True, 30),
            ("bocah_ep_ep", "Alok Free Fire", grup_reg_id, 30, True, 3),
            ("tante_gaming", "Mbak Indah Streaming", grup_vip_id, 800, True, 10),
            ("mbak_admin", "Admin Cantik Warnet", grup_vip_id, 2400, True, None),
            ("casual_player_1", "Budi Santoso", grup_reg_id, 120, True, 7),
            ("phantom_assassin", "Mortred Critical", grup_vip_id, 450, True, 14),
            ("shadow_fiend", "Nevermore Mid", grup_reg_id, 0, True, None),
            ("invoker_pro", "Kael Sunstrike", grup_vvip_id, 650, True, 12),
            ("techies_toxic", "Tukang Ranjau", grup_reg_id, 100, False, 2), # Locked account
            ("windrunner", "Lyralei Shackle", grup_vip_id, 320, True, 6),
            ("mirana_gaming", "Arrow Nyasar", grup_reg_id, 0, True, -2), # Expired 2 days ago
            ("pudge_mid", "Tukang Hook Miss", grup_reg_id, 50, True, -5), # Expired 5 days ago
            ("crystal_maiden", "Rylai Support", grup_vip_id, 180, True, 5),
            ("rubick_steal", "Grand Magus", grup_vvip_id, 1200, True, 20),
            ("juggernaut_carry", "Yurnero Omnislash", grup_vip_id, 900, True, 25),
            ("sniper_keker", "Kardel Assassinate", grup_reg_id, 45, True, 1),
            ("zeus_petir", "Dewa Listrik", grup_vip_id, 0, True, None),
            ("spectre_bayang", "Mercurial Haunt", grup_vvip_id, 3000, True, 30),
            ("anti_mage", "Magina Blink", grup_reg_id, 60, True, 4),
            ("faceless_void", "Darkterror Chrono", grup_vip_id, 150, True, 8),
            ("riki_ngilang", "Stealth Backstab", grup_reg_id, 200, False, 10), # Locked
            ("viper_racun", "Netherdrake Poison", grup_reg_id, 0, True, -1), # Expired 1 day ago
            ("doom_bringer", "Lucifer Silenced", grup_vvip_id, 800, True, 14),
            ("clinkz_panah", "Skeleton Archer", grup_reg_id, 120, True, 3),
            ("slark_loncat", "Piranha Leap", grup_vip_id, 360, True, 9),
            ("ursa_cakar", "Fuzzy Wuzzy", grup_reg_id, 500, True, 15),
            ("axe_muter", "Mogul Khan Call", grup_reg_id, 0, True, None),
            ("centaur_seruduk", "Bradwardine Stampede", grup_vip_id, 240, True, 5),
            ("tide_gurita", "Leviathan Ravage", grup_reg_id, 150, False, 1), # Locked
            ("magnus_dorong", "Reverse Polarity", grup_vvip_id, 1300, True, 18),
            ("kunkka_kapal", "Admiral Torrent", grup_vip_id, 400, True, 11),
            ("sven_tebas", "Rogue Knight God Strength", grup_reg_id, 75, True, 6),
            ("slardar_ketok", "Deep One Crush", grup_reg_id, 0, True, -10), # Expired 10 days ago
            ("luna_bulan", "Nova Eclipse", grup_vvip_id, 5000, True, 30)
        ]

        members = []
        now = now_local()

        for idx, item in enumerate(member_names):
            uname, full_name, g_id, minutes, is_active, exp_offset = item
            
            # Setup Expiration Date
            exp_date = None
            if exp_offset is not None:
                exp_date = now + timedelta(days=exp_offset)

            mem = Member(
                username=uname,
                nama_lengkap=full_name,
                email=f"{uname}@tmbilling.id",
                no_hp=f"081234567{idx:02d}",
                grup_id=g_id,
                aktif=is_active,
                waktu_tersimpan=minutes,
                kadaluarsa_pada=exp_date
            )
            mem.set_password("123456") # Password testing default
            members.append(mem)

        db.session.add_all(members)
        db.session.commit()
        print(f"[OK] Selesai seeding {len(members)} data Member Dota/Gaming!")

        print("\n[FINISH] Seeding Masif Selesai! Database Anda sekarang berisi:")
        print("   - 3 Grup (Reguler, VIP, VVIP)")
        print("   - 2 Staff User ('admin' & 'kasir', pass sesuai username)")
        print(f"   - {len(pcs)} Unit PC")
        print(f"   - {len(pakets)} Pilihan Paket Billing")
        print(f"   - {len(members)} Akun Member")
        print("Database siap digunakan untuk stress-test paginasi & visual layout!")

if __name__ == "__main__":
    run_seed()