"""Seeder data awal untuk E2E Sandbox testing.

Skrip ini mengisi database sandbox terisolasi secara idempotent:
- Akun Superadmin ('admin' / 'admin123') & Kasir ('kasir1' / 'kasir123')
- 3 Grup PC (reguler, vip, vvip)
- 5 Unit PC (PC-01 s.d. PC-05)
- 4 Paket Billing (1 Jam, 2 Jam, 3 Jam, Paket Malam)
- 5 Item Menu FnB
- 3 Member terdaftar
- Konfigurasi Settings dasar
"""

from datetime import datetime, timedelta
from app.models import db, User, Grup, PC, Paket, MenuItem, Member, Settings


def seed_sandbox(app):
    """Mengisi database sandbox dengan data pengujian secara idempotent."""
    with app.app_context():
        db.create_all()

        # 1. Admin & Kasir
        admin = User.query.filter_by(username="admin").first()
        if not admin:
            admin = User(username="admin", nama_lengkap="Administrator E2E", role="admin", aktif=True)
            db.session.add(admin)
        else:
            admin.nama_lengkap = "Administrator E2E"
            admin.role = "admin"
            admin.aktif = True
        admin.set_password("admin123")

        kasir = User.query.filter_by(username="kasir1").first()
        if not kasir:
            kasir = User(username="kasir1", nama_lengkap="Kasir Pagi E2E", role="kasir", aktif=True)
            db.session.add(kasir)
        else:
            kasir.nama_lengkap = "Kasir Pagi E2E"
            kasir.role = "kasir"
            kasir.aktif = True
        kasir.set_password("kasir123")
        db.session.commit()

        # 2. Grup PC
        def get_or_create_grup(nama, warna, ket):
            g = Grup.query.filter_by(nama=nama).first()
            if not g:
                g = Grup(nama=nama, warna=warna, keterangan=ket)
                db.session.add(g)
                db.session.commit()
            return g

        g_reg = get_or_create_grup("reguler", "#3b82f6", "Area Reguler 60Hz")
        g_vip = get_or_create_grup("vip", "#ec4899", "Area VIP 144Hz")
        g_vvip = get_or_create_grup("vvip", "#a855f7", "Area VVIP 240Hz")

        # 3. Unit PC
        for i in range(1, 6):
            kode = f"PC-0{i}"
            pc = PC.query.filter_by(kode=kode).first()
            if not pc:
                pc = PC(
                    kode=kode,
                    nama=f"Meja 0{i}",
                    ip_address=f"192.168.1.{10+i}",
                    mac_address=f"00:11:22:33:44:0{i}",
                    grup_id=g_reg.id,
                    aktif=True,
                    pos_x=50 + (i * 90),
                    pos_y=100
                )
                db.session.add(pc)
        db.session.commit()

        # 4. Paket Billing
        pakets = [
            ("1 Jam Reguler", 60, 5000),
            ("2 Jam Reguler", 120, 9000),
            ("3 Jam Reguler", 180, 13000),
            ("Paket Malam", 360, 20000)
        ]
        for nama, durasi, harga in pakets:
            p = Paket.query.filter_by(nama=nama).first()
            if not p:
                p = Paket(nama=nama, durasi_menit=durasi, harga=harga, grup_id=g_reg.id, aktif=True)
                db.session.add(p)
        db.session.commit()

        # 5. Menu FnB Kantin
        menus = [
            ("Indomie Goreng", 10000, 20),
            ("Kopi Good Day", 6000, 30),
            ("Aqua Botol 600ml", 4000, 50),
            ("French Fries", 12000, 15),
            ("Teh Botol", 5000, 25)
        ]
        for nama, harga, stok in menus:
            m = MenuItem.query.filter_by(nama=nama).first()
            if not m:
                m = MenuItem(nama=nama, harga=harga, stok=stok, is_active=True)
                db.session.add(m)
        db.session.commit()

        # 6. Member
        members_data = [
            ("member1", "Budi Santoso", "budi@example.com", "081211112222", g_reg.id, 120),
            ("member2", "Siti Rahma", "siti@example.com", "081233334444", g_vip.id, 60),
            ("member3", "Andi Wijaya", "andi@example.com", "081255556666", g_reg.id, 0),
        ]
        for uname, nama, email, hp, gid, menit in members_data:
            mem = Member.query.filter_by(username=uname).first()
            if not mem:
                mem = Member(
                    username=uname,
                    nama_lengkap=nama,
                    email=email,
                    no_hp=hp,
                    grup_id=gid,
                    waktu_tersimpan=menit,
                    kadaluarsa_pada=datetime.utcnow() + timedelta(days=30),
                    aktif=True
                )
                mem.set_password("pass123")
                db.session.add(mem)
        db.session.commit()

        # 7. Konfigurasi Awal
        config_keys = {
            "warnet_name": "TMBilling Arena Pro",
            "blackout_grace_minutes": "15",
            "timezone": "Asia/Jakarta",
            "vnc_password": "TMVncSecret123"
        }
        for k, v in config_keys.items():
            s = Settings.query.filter_by(key=k).first()
            if not s:
                s = Settings(key=k, value=v)
                db.session.add(s)
            else:
                s.value = v
        db.session.commit()
