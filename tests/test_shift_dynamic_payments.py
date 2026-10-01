# tests/test_shift_dynamic_payments.py
import pytest
from app import create_app, db
from app.models import User, ShiftRecord, Transaksi, TransaksiMenu
from app.services.shift.shift_service import ShiftService
from app.services.settings.settings_service import SettingsService

@pytest.fixture
def shift_multi_payment_ctx():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.create_all()
        # Set konfigurasi payment_methods termasuk OVO yang bernilai 0 transaksi
        SettingsService.set("payment_methods", "Tunai, QRIS, Transfer Bank, Debit BCA, Alipay, Alibaba, OVO")
        
        kasir = User(username="kasir_pay", role="kasir")
        kasir.set_password("pass123")
        db.session.add(kasir)
        db.session.commit()
        yield app, kasir
        db.session.remove()
        db.drop_all()

def test_dynamic_payment_summary_calculation(shift_multi_payment_ctx):
    app, kasir = shift_multi_payment_ctx
    shift = ShiftService.start_shift("kasir_pay", modal_awal=100000, operator="kasir_pay")

    from app.models.menu.menu import MenuItem
    menu1 = MenuItem(nama="Kopi Hitam", harga=5000, stok=100)
    db.session.add(menu1)
    db.session.flush()

    # Transaksi Billing: Tunai (50k), QRIS (30k), Transfer Bank (40k), Alipay (35k)
    t1 = Transaksi(user_id=kasir.id, jumlah=50000, metode_pembayaran="Tunai", jenis="paket_personal")
    t2 = Transaksi(user_id=kasir.id, jumlah=30000, metode_pembayaran="QRIS", jenis="paket_personal")
    t3 = Transaksi(user_id=kasir.id, jumlah=40000, metode_pembayaran="Transfer Bank", jenis="paket_personal")
    t4 = Transaksi(user_id=kasir.id, jumlah=35000, metode_pembayaran="Alipay", jenis="paket_personal")
    
    # Transaksi Kantin: Tunai (20k), QRIS (15k), Debit BCA (25k), Alibaba (50k)
    tm1 = TransaksiMenu(no_nota="N01", menu_id=menu1.id, jumlah=4, kasir_id=kasir.id, total_harga=20000, metode_pembayaran="Tunai")
    tm2 = TransaksiMenu(no_nota="N02", menu_id=menu1.id, jumlah=3, kasir_id=kasir.id, total_harga=15000, metode_pembayaran="QRIS")
    tm3 = TransaksiMenu(no_nota="N03", menu_id=menu1.id, jumlah=5, kasir_id=kasir.id, total_harga=25000, metode_pembayaran="Debit BCA")
    tm4 = TransaksiMenu(no_nota="N04", menu_id=menu1.id, jumlah=10, kasir_id=kasir.id, total_harga=50000, metode_pembayaran="Alibaba")

    # Refund Tunai: 10k
    t_ref = Transaksi(user_id=kasir.id, jumlah=10000, metode_pembayaran="Tunai", jenis="refund_paket")

    db.session.add_all([t1, t2, t3, t4, tm1, tm2, tm3, tm4, t_ref])
    db.session.commit()

    summary = ShiftService.get_shift_summary(shift.id)

    # Verifikasi total tunai bersih: Billing Tunai (50k) + Kantin Tunai (20k) - Refund (10k) = 60k
    # Uang seharusnya di laci = modal awal (100k) + total tunai bersih (60k) = 160k
    assert summary["total_seharusnya"] == 160000

    # Verifikasi rincian non-tunai dinamis (QRIS, Transfer, Debit, Alipay, Alibaba, OVO)
    breakdown = summary["rincian_pembayaran"]
    assert breakdown["tunai"]["total"] == 60000
    
    non_tunai_map = {item["method"]: item["total"] for item in breakdown["non_tunai"]}
    assert non_tunai_map["QRIS"] == 45000  # 30k + 15k
    assert non_tunai_map["Transfer Bank"] == 40000
    assert non_tunai_map["Debit BCA"] == 25000
    assert non_tunai_map["Alipay"] == 35000
    assert non_tunai_map["Alibaba"] == 50000
    # Metode yang ada di konfigurasi tapi tidak ada transaksi tetap muncul dengan nilai 0
    if "OVO" in non_tunai_map:
        assert non_tunai_map["OVO"] == 0

    # Tutup shift dengan blind count 160.000 (PAS)
    res = ShiftService.end_shift(shift.id, uang_fisik=160000, catatan="Lancar", operator="kasir_pay")
    assert res["selisih"] == 0

    # Verifikasi teks struk thermal 58mm
    receipt = ShiftService.generate_shift_receipt_text(shift.id)
    assert "QRIS" in receipt
    assert "Transfer Bank" in receipt
    assert "Uang Fisik Laci:" in receipt
    assert "Rp 160,000" in receipt
    assert "PAS" in receipt
