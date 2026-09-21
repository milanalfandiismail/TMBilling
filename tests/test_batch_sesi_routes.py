# tests/test_batch_sesi_routes.py
"""Automated tests for batch session and remote endpoints."""

import pytest
from app import create_app, db
from app.models import PC, Paket, Grup, Sesi, Transaksi
from app.services import SesiService, PCService, PaketService


@pytest.fixture
def app_and_client():
    app = create_app()
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False

    with app.app_context():
        # Setup test data
        grup = Grup.query.filter_by(nama="grup_batch_test").first()
        if not grup:
            grup = Grup(nama="grup_batch_test", warna="#333333")
            db.session.add(grup)
            db.session.commit()

        # Create or fetch 3 test PCs
        for code in ["BATCH-PC-1", "BATCH-PC-2", "BATCH-PC-3"]:
            pc = PC.query.filter_by(kode=code).first()
            if not pc:
                pc = PC(kode=code, nama=code, ip_address="192.168.1.200", grup_id=grup.id)
                db.session.add(pc)
        
        # Create test package
        paket = Paket.query.filter_by(nama="Paket Batch 1 Jam").first()
        if not paket:
            paket = Paket(nama="Paket Batch 1 Jam", durasi_menit=60, harga=10000, grup_id=grup.id, aktif=True)
            db.session.add(paket)
        db.session.commit()

    with app.test_client() as client:
        with client.session_transaction() as sess:
            sess["kasir_id"] = 1
            sess["kasir_role"] = "admin"
            sess["kasir_username"] = "admin"
        yield app, client

    with app.app_context():
        # Cleanup any active sessions, transactions, and objects on batch PCs
        for code in ["BATCH-PC-1", "BATCH-PC-2", "BATCH-PC-3"]:
            pc = PC.query.filter_by(kode=code).first()
            if pc:
                sesis = Sesi.query.filter_by(pc_id=pc.id).all()
                for s in sesis:
                    Transaksi.query.filter_by(sesi_id=s.id).delete()
                    db.session.delete(s)
                db.session.delete(pc)
        
        paket = Paket.query.filter_by(nama="Paket Batch 1 Jam").first()
        if paket:
            db.session.delete(paket)
            
        grup = Grup.query.filter_by(nama="grup_batch_test").first()
        if grup:
            db.session.delete(grup)
            
        db.session.commit()


def test_buka_guest_batch_success(app_and_client):
    """Test buka sesi guest batch di beberapa PC sekaligus."""
    app, client = app_and_client
    with app.app_context():
        paket = Paket.query.filter_by(nama="Paket Batch 1 Jam").first()
        assert paket is not None
        paket_id = paket.id

    res = client.post("/api/v1/kasir/sesi/buka-guest-batch", json={
        "pc_kodes": ["BATCH-PC-1", "BATCH-PC-2"],
        "paket_id": paket_id,
        "nama_guest_prefix": "Squad",
        "metode_pembayaran": "Tunai"
    })
    assert res.status_code == 201
    data = res.get_json()
    assert data["success"] is True
    assert data["total_success"] == 2
    assert len(data["created"]) == 2
    assert data["created"][0]["nama_guest"] == "Squad-1"
    assert data["created"][1]["nama_guest"] == "Squad-2"


def test_tambah_waktu_batch_and_tutup_batch(app_and_client):
    """Test tambah waktu batch dan tutup sesi batch."""
    app, client = app_and_client
    with app.app_context():
        paket = Paket.query.filter_by(nama="Paket Batch 1 Jam").first()
        paket_id = paket.id

    # 1. Buka sesi
    res_buka = client.post("/api/v1/kasir/sesi/buka-guest-batch", json={
        "pc_kodes": ["BATCH-PC-1", "BATCH-PC-2"],
        "paket_id": paket_id,
        "nama_guest_prefix": "Team",
        "metode_pembayaran": "Tunai"
    })
    assert res_buka.status_code == 201
    created = res_buka.get_json()["created"]
    sesi_ids = [c["sesi_id"] for c in created]

    # 2. Tambah waktu batch
    res_tambah = client.post("/api/v1/kasir/sesi/tambah-waktu-batch", json={
        "sesi_ids": sesi_ids,
        "paket_id": paket_id,
        "qty": 1,
        "metode_pembayaran": "Tunai"
    })
    assert res_tambah.status_code == 200
    assert res_tambah.get_json()["total_success"] == 2

    # 3. Tutup sesi batch
    res_tutup = client.post("/api/v1/kasir/sesi/tutup-batch", json={
        "sesi_ids": sesi_ids
    })
    assert res_tutup.status_code == 200
    assert res_tutup.get_json()["total_success"] == 2


def test_remote_action_batch(app_and_client):
    """Test trigger remote action batch (shutdown/restart)."""
    app, client = app_and_client
    with app.app_context():
        pcs = PC.query.filter(PC.kode.in_(["BATCH-PC-1", "BATCH-PC-2"])).all()
        pc_ids = [p.id for p in pcs]

    res = client.post("/api/v1/kasir/monitor/remote/batch", json={
        "pc_ids": pc_ids,
        "action": "restart"
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert data["total_success"] == len(pc_ids)
