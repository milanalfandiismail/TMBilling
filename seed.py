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
from app.models import db, now_local, Grup, PC, Paket, Member, User, Sesi, Transaksi

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

        # 5. Seeding Paket (20 Paket: 6 Reguler + 8 VIP + 6 VVIP)
        print('[ADD] Menambahkan 20 Variasi Paket Billing...')
        pakets = []

        # 6 Paket Reguler
        pakets.append(Paket(nama='Reguler - 1 Jam', grup_id=grup_reg_id, durasi_menit=60, harga=5000, kadaluarsa_hari=30))
        pakets.append(Paket(nama='Reguler - 2 Jam', grup_id=grup_reg_id, durasi_menit=120, harga=9000, kadaluarsa_hari=30))
        pakets.append(Paket(nama='Reguler - 3 Jam', grup_id=grup_reg_id, durasi_menit=180, harga=13000, kadaluarsa_hari=30))
        pakets.append(Paket(nama='Reguler - 5 Jam', grup_id=grup_reg_id, durasi_menit=300, harga=20000, kadaluarsa_hari=30))
        pakets.append(Paket(nama='Reguler - 10 Jam', grup_id=grup_reg_id, durasi_menit=600, harga=36000, kadaluarsa_hari=30))
        pakets.append(Paket(nama='Reguler Begadang', grup_id=grup_reg_id, durasi_menit=480, harga=15000, kadaluarsa_hari=1))

        # 8 Paket VIP
        pakets.append(Paket(nama='VIP - 1 Jam', grup_id=grup_vip_id, durasi_menit=60, harga=8000, kadaluarsa_hari=30))
        pakets.append(Paket(nama='VIP - 2 Jam', grup_id=grup_vip_id, durasi_menit=120, harga=15000, kadaluarsa_hari=30))
        pakets.append(Paket(nama='VIP - 3 Jam', grup_id=grup_vip_id, durasi_menit=180, harga=21000, kadaluarsa_hari=30))
        pakets.append(Paket(nama='VIP - 5 Jam', grup_id=grup_vip_id, durasi_menit=300, harga=32000, kadaluarsa_hari=30))
        pakets.append(Paket(nama='VIP - 8 Jam', grup_id=grup_vip_id, durasi_menit=480, harga=50000, kadaluarsa_hari=30))
        pakets.append(Paket(nama='VIP - 10 Jam', grup_id=grup_vip_id, durasi_menit=600, harga=60000, kadaluarsa_hari=30))
        pakets.append(Paket(nama='VIP Begadang', grup_id=grup_vip_id, durasi_menit=600, harga=35000, kadaluarsa_hari=1))
        pakets.append(Paket(nama='VIP Happy Hour', grup_id=grup_vip_id, durasi_menit=180, harga=10000, kadaluarsa_hari=1))

        # 6 Paket VVIP
        pakets.append(Paket(nama='VVIP - 1 Jam', grup_id=grup_vvip_id, durasi_menit=60, harga=15000, kadaluarsa_hari=15))
        pakets.append(Paket(nama='VVIP - 3 Jam', grup_id=grup_vvip_id, durasi_menit=180, harga=40000, kadaluarsa_hari=15))
        pakets.append(Paket(nama='VVIP - 5 Jam', grup_id=grup_vvip_id, durasi_menit=300, harga=60000, kadaluarsa_hari=15))
        pakets.append(Paket(nama='VVIP - 10 Jam', grup_id=grup_vvip_id, durasi_menit=600, harga=110000, kadaluarsa_hari=15))
        pakets.append(Paket(nama='VVIP Full Day', grup_id=grup_vvip_id, durasi_menit=1440, harga=200000, kadaluarsa_hari=5))
        pakets.append(Paket(nama='VVIP Sultan Party', grup_id=grup_vvip_id, durasi_menit=4320, harga=500000, kadaluarsa_hari=3))

        db.session.add_all(pakets)
        db.session.commit()
        print(f"[OK] Selesai seeding {len(pakets)} variasi Paket!")

        # 6. Seeding Member (100 Member untuk Paginasi)
        print('[ADD] Menambahkan 100 Member...')

        # Generate 100 member names
        nama_depan = ['Alok', 'Budi', 'Citra', 'Dimas', 'Eka', 'Fajar', 'Gita', 'Hendra', 'Intan', 'Joko',
                      'Kevin', 'Lina', 'Mega', 'Nando', 'Olivia', 'Putra', 'Rina', 'Sandi', 'Tari', 'Ujang',
                      'Vina', 'Wawan', 'Xena', 'Yoga', 'Zara', 'Adit', 'Bayu', 'Cici', 'Doni', 'Elsa',
                      'Fani', 'Gilang', 'Hana', 'Irfan', 'Jenny', 'Krisna', 'Laura', 'Mahesa', 'Nia', 'Omar',
                      'Priya', 'Rama', 'Siska', 'Toni', 'Ulfah', 'Vicky', 'Winda', 'Yanti', 'Zaki', 'Agung',
                      'Bella', 'Candra', 'Dewi', 'Evan', 'Fitri', 'Galih', 'Hesti', 'Ipul', 'Jasmine', 'Kiki',
                      'Luki', 'Mira', 'Novi', 'Ojan', 'Pandu', 'Riska', 'Sidiq', 'Tiara', 'Umar', 'Vero',
                      'Wahyu', 'Yuda', 'Zulfan', 'Akbar', 'Bunga', 'Cipto', 'Dinda', 'Erwin', 'Fina', 'Guntur',
                      'Hilda', 'Iqbal', 'Jihan', 'Karina', 'Leo', 'Maya', 'Natan', 'Opik', 'Paula', 'Rizky',
                      'Sinta', 'Taufik', 'Ucok', 'Valent', 'Wati', 'Yunus', 'Zidan', 'Ayu', 'Dodi', 'Fahmi']

        members = []
        now = now_local()
        grup_ids = [grup_reg_id, grup_vip_id, grup_vvip_id]

        for idx, nama in enumerate(nama_depan):
            uname = nama.lower() + str(random.randint(10, 999))
            gid = random.choice(grup_ids)
            minutes = random.choice([0, 30, 60, 120, 180, 300, 480, 600, 1200, 2400, 4320, 5000])
            aktif = random.random() > 0.15  # 85% aktif
            exp_offset = random.choice([None, 1, 3, 5, 7, 14, 30, -1, -5, -10])
            exp_date = None if exp_offset is None else now + timedelta(days=exp_offset)

            mem = Member(
                username=uname,
                nama_lengkap=nama + ' ' + random.choice(['Warnet', 'Gaming', 'Player', 'Stream', 'ID']),
                email=f'{uname}@tmbilling.id',
                no_hp=f'0812{random.randint(10000000, 99999999)}',
                grup_id=gid,
                aktif=aktif,
                waktu_tersimpan=minutes,
                kadaluarsa_pada=exp_date
            )
            mem.set_password('123456')
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