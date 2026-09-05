# tests/test_menu_crud_robustness.py
"""Test suite untuk memastikan ketahanan Menu CRUD terhadap berbagai payload (form-data, JSON, null/empty)."""

import pytest
from app import create_app
from app.models import db, User, MenuItem


@pytest.fixture
def client_with_admin():
    app = create_app()
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False
    with app.test_client() as client:
        with client.session_transaction() as sess:
            sess["kasir_id"] = 1
            sess["kasir_role"] = "admin"
            sess["kasir_username"] = "admin"
        yield client


def test_create_menu_form_data(client_with_admin):
    """Membuat menu baru menggunakan multipart/form-data."""
    res = client_with_admin.post("/api/v1/kasir/menu/", data={
        "nama": "Nasi Goreng Spesial",
        "harga": 15000,
        "stok": 20
    })
    assert res.status_code == 201
    data = res.get_json()
    assert data["success"] is True
    assert data["data"]["nama"] == "Nasi Goreng Spesial"
    assert data["data"]["harga"] == 15000


def test_create_menu_json_payload(client_with_admin):
    """Membuat menu baru menggunakan JSON payload."""
    res = client_with_admin.post("/api/v1/kasir/menu/", json={
        "nama": "Mie Goreng Jumbo",
        "harga": 12000,
        "stok": 15
    })
    assert res.status_code == 201
    data = res.get_json()
    assert data["success"] is True
    assert data["data"]["nama"] == "Mie Goreng Jumbo"


def test_create_menu_null_and_empty_nama_handling(client_with_admin):
    """Memastikan backend tidak crash AttributeError (NoneType has no attribute strip) saat nama null atau kosong."""
    # 1. Null di JSON
    res1 = client_with_admin.post("/api/v1/kasir/menu/", json={
        "nama": None,
        "harga": 5000,
        "stok": 10
    })
    assert res1.status_code == 400
    assert "Nama menu tidak boleh kosong" in res1.get_json()["error"]

    # 2. Key nama tidak disertakan sama sekali
    res2 = client_with_admin.post("/api/v1/kasir/menu/", data={
        "harga": 5000,
        "stok": 10
    })
    assert res2.status_code == 400
    assert "Nama menu tidak boleh kosong" in res2.get_json()["error"]

    # 3. String spasi saja
    res3 = client_with_admin.post("/api/v1/kasir/menu/", data={
        "nama": "   ",
        "harga": 5000,
        "stok": 10
    })
    assert res3.status_code == 400
    assert "Nama menu tidak boleh kosong" in res3.get_json()["error"]


def test_update_menu_json_and_null_handling(client_with_admin):
    """Memastikan update menu mendukung JSON dan aman terhadap null nama."""
    # Buat menu awal
    res = client_with_admin.post("/api/v1/kasir/menu/", json={
        "nama": "Es Jeruk Peras",
        "harga": 6000,
        "stok": 30
    })
    menu_id = res.get_json()["data"]["id"]

    # Update via JSON
    res_up = client_with_admin.put(f"/api/v1/kasir/menu/{menu_id}", json={
        "nama": "Es Jeruk Manis",
        "harga": 7000
    })
    assert res_up.status_code == 200
    assert res_up.get_json()["data"]["nama"] == "Es Jeruk Manis"
    assert res_up.get_json()["data"]["harga"] == 7000

    # Update dengan nama=None (tidak boleh crash, hanya abaikan update nama)
    res_null = client_with_admin.put(f"/api/v1/kasir/menu/{menu_id}", json={
        "nama": None,
        "stok": 50
    })
    assert res_null.status_code == 200
    assert res_null.get_json()["data"]["nama"] == "Es Jeruk Manis"
    assert res_null.get_json()["data"]["stok"] == 50
