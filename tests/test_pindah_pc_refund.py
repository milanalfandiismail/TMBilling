# tests/test_pindah_pc_refund.py
import pytest
from app import create_app
from app.models import db, Grup, PC, Paket, Sesi, Transaksi
from app.services.sesi.sesi_service import SesiService


@pytest.fixture
def app_context():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.create_all()
        g = Grup(nama="reguler", keterangan="Reguler Zone", warna="#888888")
        db.session.add(g)
        db.session.commit()
        
        pc1 = PC(kode="PC01", nama="PC 01", grup_id=g.id)
        pc2 = PC(kode="PC02", nama="PC 02", grup_id=g.id)
        pc3 = PC(kode="PC03", nama="PC 03", grup_id=g.id)
        
        pkt1 = Paket(nama="Paket 1 Jam", durasi_menit=60, harga=5000, grup_id=g.id, aktif=True)
        pkt2 = Paket(nama="Paket 2 Jam", durasi_menit=120, harga=10000, grup_id=g.id, aktif=True)
        
        db.session.add_all([pc1, pc2, pc3, pkt1, pkt2])
        db.session.commit()
        
        yield app
        db.session.remove()
        db.drop_all()


def test_refund_paket_guest_after_pindah_pc(app_context):
    """Pastikan riwayat paket guest tetap tersedia dan dapat direfund setelah pindah PC."""
    pkt1 = Paket.query.filter_by(nama="Paket 1 Jam").first()
    
    # 1. Buka sesi guest di PC01
    sesi1 = SesiService.buka_guest("PC01", pkt1.id, nama_guest="Guest Alpha")
    assert sesi1.status == "aktif"
    assert sesi1.pc.kode == "PC01"
    assert sesi1.durasi_beli_menit == 60
    
    # Cek riwayat paket di sesi1
    riwayat1 = SesiService.get_riwayat_paket_sesi(sesi1.id)
    assert len(riwayat1) == 1
    assert riwayat1[0]["nama"] == "Paket 1 Jam"
    t_id1 = riwayat1[0]["id"]
    
    # 2. Pindah PC dari PC01 ke PC02
    res_pindah = SesiService.pindah_pc(sesi1.id, "PC02", operator="kasir")
    assert res_pindah["pc_baru"] == "PC02"
    
    # Sesi lama harus selesai, sesi baru di PC02 harus aktif
    sesi_lama = Sesi.query.get(sesi1.id)
    assert sesi_lama.status == "selesai"
    
    sesi2 = Sesi.query.filter_by(pc_id=PC.query.filter_by(kode="PC02").first().id, status="aktif").first()
    assert sesi2 is not None
    assert sesi2.sesi_asal_id == sesi1.id
    
    # 3. Ambil riwayat paket di sesi baru (PC02) -> HARUS ADA paket dari PC01!
    riwayat2 = SesiService.get_riwayat_paket_sesi(sesi2.id)
    assert len(riwayat2) == 1
    assert riwayat2[0]["id"] == t_id1
    assert riwayat2[0]["nama"] == "Paket 1 Jam"
    
    # 4. Lakukan refund paket dari PC02
    refund_res = SesiService.refund_paket_guest(sesi2.id, t_id1, operator="kasir")
    assert refund_res["nama_guest"] == "Guest Alpha"
    assert refund_res["durasi_dikurangi"] == 60
    
    # Verifikasi transaksi di-mark is_refunded
    transaksi1 = Transaksi.query.get(t_id1)
    assert transaksi1.is_refunded is True
    
    # Riwayat paket di PC02 sekarang harus kosong (karena sudah direfund)
    riwayat2_after = SesiService.get_riwayat_paket_sesi(sesi2.id)
    assert len(riwayat2_after) == 0


def test_multi_pindah_pc_and_multi_paket_refund(app_context):
    """Test skenario pindah PC berkali-kali (PC01 -> PC02 -> PC03) dengan pembelian paket tambahan."""
    pkt1 = Paket.query.filter_by(nama="Paket 1 Jam").first()
    pkt2 = Paket.query.filter_by(nama="Paket 2 Jam").first()
    
    # 1. Buka sesi di PC01 dengan Paket 1 Jam
    sesi1 = SesiService.buka_guest("PC01", pkt1.id, nama_guest="Guest Multi")
    
    # 2. Pindah ke PC02
    SesiService.pindah_pc(sesi1.id, "PC02", operator="kasir")
    sesi2 = Sesi.query.filter_by(pc_id=PC.query.filter_by(kode="PC02").first().id, status="aktif").first()
    assert sesi2.sesi_asal_id == sesi1.id
    
    # 3. Tambah waktu di PC02 dengan Paket 2 Jam
    SesiService.tambah_waktu_sesi(sesi2.id, pkt2, operator="kasir")
    
    # 4. Pindah lagi dari PC02 ke PC03
    SesiService.pindah_pc(sesi2.id, "PC03", operator="kasir")
    sesi3 = Sesi.query.filter_by(pc_id=PC.query.filter_by(kode="PC03").first().id, status="aktif").first()
    assert sesi3.sesi_asal_id == sesi1.id # Harus tetap merujuk ke root sesi1
    
    # 5. Cek riwayat paket di PC03 -> Harus ada 2 paket (Paket 2 Jam terbaru & Paket 1 Jam lama)
    riwayat3 = SesiService.get_riwayat_paket_sesi(sesi3.id)
    assert len(riwayat3) == 2
    assert riwayat3[0]["nama"] == "Paket 2 Jam"
    assert riwayat3[1]["nama"] == "Paket 1 Jam"
    
    # 6. Refund paket pertama (Paket 1 Jam) dari PC03
    t_id_lama = riwayat3[1]["id"]
    refund_res = SesiService.refund_paket_guest(sesi3.id, t_id_lama, operator="kasir")
    assert refund_res["durasi_dikurangi"] == 60
    
    # 7. Riwayat paket sekarang hanya tinggal Paket 2 Jam
    riwayat3_after = SesiService.get_riwayat_paket_sesi(sesi3.id)
    assert len(riwayat3_after) == 1
    assert riwayat3_after[0]["nama"] == "Paket 2 Jam"
    
    # 8. Refund paket kedua (Paket 2 Jam) dari PC03
    t_id_baru = riwayat3_after[0]["id"]
    refund_res2 = SesiService.refund_paket_guest(sesi3.id, t_id_baru, operator="kasir")
    assert refund_res2["durasi_dikurangi"] == 120
    
    # Riwayat sekarang kosong
    assert len(SesiService.get_riwayat_paket_sesi(sesi3.id)) == 0


def test_session_isolation_new_guest_does_not_see_previous_guest_packages(app_context):
    """Pastikan guest baru di PC yang sama tidak melihat paket dari guest sebelumnya."""
    pkt1 = Paket.query.filter_by(nama="Paket 1 Jam").first()
    
    # 1. Guest 1 main di PC01 lalu tutup sesi
    sesi1 = SesiService.buka_guest("PC01", pkt1.id, nama_guest="Guest Lama")
    SesiService.tutup_sesi(sesi1.id, operator="kasir")
    
    # 2. Guest 2 buka sesi di PC01
    sesi2 = SesiService.buka_guest("PC01", pkt1.id, nama_guest="Guest Baru")
    
    # Riwayat paket Guest 2 hanya paket milik Guest 2 sendiri
    riwayat = SesiService.get_riwayat_paket_sesi(sesi2.id)
    assert len(riwayat) == 1
    assert riwayat[0]["id"] != sesi1.id
    assert sesi2.sesi_asal_id is None
