# tests/test_pc_validation.py
"""Automated unit tests for PC code validation and length limits."""

import pytest
from app import create_app, db
from app.models import PC, Grup
from app.services import PCService


@pytest.fixture
def test_client():
    app = create_app()
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False

    with app.app_context():
        grup = Grup.query.filter_by(nama="test_pc_val_grup").first()
        if not grup:
            grup = Grup(nama="test_pc_val_grup", warna="#112233")
            db.session.add(grup)
            db.session.commit()

    with app.test_client() as client:
        with client.session_transaction() as sess:
            sess["kasir_id"] = 1
            sess["kasir_role"] = "admin"
            sess["kasir_username"] = "admin"
        yield app, client

    with app.app_context():
        # Cleanup created test PCs and test group
        grup = Grup.query.filter_by(nama="test_pc_val_grup").first()
        if grup:
            PC.query.filter_by(grup_id=grup.id).delete()
            db.session.delete(grup)
            db.session.commit()


def test_pc_create_valid_codes(test_client):
    app, client = test_client
    with app.app_context():
        # 1. Standard valid code (7 chars)
        res1 = client.post("/api/v1/kasir/pc/", json={
            "kode": "TEST-01",
            "grup": "test_pc_val_grup",
            "ip_address": "10.0.1.1"
        })
        assert res1.status_code == 201
        assert res1.get_json()["pc"]["kode"] == "TEST-01"

        # 2. 9-character code (supports thousands of PCs e.g. VVIP-2000)
        res2 = client.post("/api/v1/kasir/pc/", json={
            "kode": "VVIP-2000",
            "grup": "test_pc_val_grup",
            "ip_address": "10.0.1.2"
        })
        assert res2.status_code == 201
        assert res2.get_json()["pc"]["kode"] == "VVIP-2000"

        # 3. 11-character code (exact maximum limit e.g. MANTAP-1000)
        res3 = client.post("/api/v1/kasir/pc/", json={
            "kode": "MANTAP-1000",
            "grup": "test_pc_val_grup",
            "ip_address": "10.0.1.3"
        })
        assert res3.status_code == 201
        assert res3.get_json()["pc"]["kode"] == "MANTAP-1000"


def test_pc_create_invalid_exceeds_max_length(test_client):
    app, client = test_client
    with app.app_context():
        # 12 characters or more -> must be rejected with 400
        res = client.post("/api/v1/kasir/pc/", json={
            "kode": "MANTAP-10000",
            "grup": "test_pc_val_grup",
            "ip_address": "10.0.1.4"
        })
        assert res.status_code == 400
        assert "maksimal 11 karakter" in res.get_json()["error"].lower()


def test_pc_create_invalid_characters(test_client):
    app, client = test_client
    with app.app_context():
        # Contains spaces or illegal symbols
        res = client.post("/api/v1/kasir/pc/", json={
            "kode": "TEST #01",
            "grup": "test_pc_val_grup",
            "ip_address": "10.0.1.5"
        })
        assert res.status_code == 400
        assert "karakter" in res.get_json()["error"].lower() or "hanya boleh" in res.get_json()["error"].lower()


def test_pc_update_validation(test_client):
    app, client = test_client
    with app.app_context():
        # Create valid PC first
        res_create = client.post("/api/v1/kasir/pc/", json={
            "kode": "TEST-02",
            "grup": "test_pc_val_grup",
            "ip_address": "10.0.1.6"
        })
        pc_id = res_create.get_json()["pc"]["id"]

        # Try update to > 11 characters -> must fail
        res_update_fail = client.put(f"/api/v1/kasir/pc/{pc_id}", json={
            "kode": "VERYLONGCODE-99"
        })
        assert res_update_fail.status_code == 400
        assert "maksimal 11 karakter" in res_update_fail.get_json()["error"].lower()

        # Update to valid 11 characters -> must succeed
        res_update_ok = client.put(f"/api/v1/kasir/pc/{pc_id}", json={
            "kode": "MANTAP-1000"
        })
        assert res_update_ok.status_code == 200


def test_pc_batch_validation(test_client):
    app, client = test_client
    with app.app_context():
        # 1. Prefix > 6 chars -> fail
        res_batch_fail1 = client.post("/api/v1/kasir/pc/batch", json={
            "prefix": "TOOLONGPREFIX-",
            "start_num": 1,
            "end_num": 2,
            "ip_start": "10.0.1.10",
            "ip_end": "10.0.1.11",
            "grup": "test_pc_val_grup"
        })
        assert res_batch_fail1.status_code == 400
        assert "prefix" in res_batch_fail1.get_json()["error"].lower()

        # 2. start_num > end_num (e.g. 100 > 50) -> fail
        res_batch_fail_order = client.post("/api/v1/kasir/pc/batch", json={
            "prefix": "PC",
            "start_num": 100,
            "end_num": 50,
            "ip_start": "10.0.1.50",
            "ip_end": "10.0.1.100",
            "grup": "test_pc_val_grup"
        })
        assert res_batch_fail_order.status_code == 400
        assert "tidak boleh lebih besar" in res_batch_fail_order.get_json()["error"].lower()

        # 3. IP count < PC count (e.g. 100 to 200 = 101 PC, but IP is only 51 IPs) -> fail
        res_batch_fail_ip_less = client.post("/api/v1/kasir/pc/batch", json={
            "prefix": "PC",
            "start_num": 100,
            "end_num": 200,
            "ip_start": "10.0.1.100",
            "ip_end": "10.0.1.150",
            "grup": "test_pc_val_grup"
        })
        assert res_batch_fail_ip_less.status_code == 400
        assert "kurang dari jumlah unit pc" in res_batch_fail_ip_less.get_json()["error"].lower()

        # 4. IP count > PC count (e.g. 100 to 105 = 6 PC, but IP is 51 IPs) -> fail
        res_batch_fail_ip_more = client.post("/api/v1/kasir/pc/batch", json={
            "prefix": "PC",
            "start_num": 100,
            "end_num": 105,
            "ip_start": "10.0.1.100",
            "ip_end": "10.0.1.150",
            "grup": "test_pc_val_grup"
        })
        assert res_batch_fail_ip_more.status_code == 400
        assert "lebih banyak dari jumlah unit pc" in res_batch_fail_ip_more.get_json()["error"].lower()

        # 5. Combination prefix (6 chars 'MANTAP') + dash + number (5 digits '10000') = 12 chars > 11 chars -> fail
        res_batch_fail2 = client.post("/api/v1/kasir/pc/batch", json={
            "prefix": "MANTAP",
            "start_num": 10000,
            "end_num": 10005,
            "ip_start": "10.0.1.20",
            "ip_end": "10.0.1.25",
            "grup": "test_pc_val_grup"
        })
        assert res_batch_fail2.status_code == 400
        assert "4 digit" in res_batch_fail2.get_json()["error"].lower() or "11 karakter" in res_batch_fail2.get_json()["error"].lower()

        # 6. Auto-dash test: prefix 'MANTAP' (without dash), 2 PCs with 2 IPs -> success
        res_batch_ok = client.post("/api/v1/kasir/pc/batch", json={
            "prefix": "MANTAP",
            "start_num": 1,
            "end_num": 2,
            "ip_start": "10.0.1.30",
            "ip_end": "10.0.1.31",
            "grup": "test_pc_val_grup"
        })
        assert res_batch_ok.status_code == 201
        assert res_batch_ok.get_json()["added"] == 2
        pc1 = PC.query.filter_by(kode="MANTAP-1").first()
        pc2 = PC.query.filter_by(kode="MANTAP-2").first()
        assert pc1 is not None
        assert pc2 is not None
        assert pc1.ip_address == "10.0.1.30"
        assert pc2.ip_address == "10.0.1.31"
