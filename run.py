from app import create_app, db
from app.models import Paket, Member, PC

app = create_app()


# run.py - UPDATE bagian seed_data()

def seed_data():
    """Isi data awal kalau database masih kosong"""
    if Paket.query.count() == 0:
        paket_list = [
            Paket(nama="1 Jam",        durasi_menit=60,   harga=5000,  kadaluarsa_hari=0),
            Paket(nama="2 Jam",        durasi_menit=120,  harga=9000,  kadaluarsa_hari=0),
            Paket(nama="3 Jam",        durasi_menit=180,  harga=12000, kadaluarsa_hari=0),
            Paket(nama="5 Jam",        durasi_menit=300,  harga=18000, kadaluarsa_hari=0),
            Paket(nama="Semalaman",    durasi_menit=600,  harga=25000, kadaluarsa_hari=0),
            Paket(nama="Member 5 Jam", durasi_menit=300,  harga=15000, kadaluarsa_hari=30),
            Paket(nama="Member 10 Jam",durasi_menit=600,  harga=28000, kadaluarsa_hari=30),
        ]
        db.session.add_all(paket_list)

    if PC.query.count() == 0:
        # Reguler PCs
        reguler_pcs = [
            PC(kode=f"PC-{i:02d}", nama=f"Komputer {i}", 
               ip_address=f"192.168.1.{i}", grup="reguler", zona="reguler")
            for i in range(1, 9)
        ]
        
        # VIP PCs
        vip_pcs = [
            PC(kode="VIP-01", nama="VIP 1", ip_address="192.168.1.101", grup="vip", zona="vip"),
            PC(kode="VIP-02", nama="VIP 2", ip_address="192.168.1.102", grup="vip", zona="vip"),
        ]
        
        # VVIP PCs
        vvip_pcs = [
            PC(kode="VVIP-01", nama="VVIP 1", ip_address="192.168.1.201", grup="vvip", zona="vvip"),
        ]
        
        db.session.add_all(reguler_pcs + vip_pcs + vvip_pcs)

    if Member.query.count() == 0:
        admin = Member(username="admin", nama_lengkap="Administrator", email="admin@warnet.local")
        admin.set_password("admin123")
        demo  = Member(username="budi",  nama_lengkap="Budi Santoso",  email="budi@demo.com")
        demo.set_password("budi123")
        db.session.add_all([admin, demo])

    db.session.commit()
    print("[seed] Data awal berhasil dimasukkan.")


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        seed_data()

    print("=" * 50)
    print("  Warnet Billing Server")
    print("  URL: http://0.0.0.0:5000")
    print("  Kasir Key: kasir-rahasia-ganti-ini")
    print("=" * 50)

    app.run(host="0.0.0.0", port=5000, debug=True)
