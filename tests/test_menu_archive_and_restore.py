# tests/test_menu_archive_and_restore.py
"""Test suite untuk fitur Arsip Menu (soft-delete, list archived, restore menu, dan proteksi duplikasi)."""

import pytest
from app import create_app
from app.models import db, User, MenuItem, TransaksiMenu
from app.services import MenuService
from app.repositories import MenuRepository


@pytest.fixture
def client_with_admin():
    app = create_app()
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False
    with app.app_context():
        test_names = ["Kopi Susu Gula Aren", "Teh Manis Dingin Jumbo"]
        for name in test_names:
            item = MenuItem.query.filter_by(nama=name).first()
            if item:
                MenuService.hard_delete_menu(item.id, operator="test")

    with app.test_client() as client:
        with client.session_transaction() as sess:
            sess["kasir_id"] = 1
            sess["kasir_role"] = "admin"
            sess["kasir_username"] = "admin"
        yield client

    with app.app_context():
        for name in test_names:
            item = MenuItem.query.filter_by(nama=name).first()
            if item:
                MenuService.hard_delete_menu(item.id, operator="test")


def test_soft_delete_and_archive_list(client_with_admin):
    """Memastikan soft delete memindahkan menu ke arsip dan muncul di endpoint archived."""
    # 1. Buat menu baru
    res_create = client_with_admin.post("/api/v1/kasir/menu/", json={
        "nama": "Kopi Susu Gula Aren",
        "harga": 12000,
        "stok": 50
    })
    assert res_create.status_code == 201
    menu_id = res_create.get_json()["data"]["id"]

    # 2. Hapus (Soft Delete)
    res_del = client_with_admin.delete(f"/api/v1/kasir/menu/{menu_id}")
    assert res_del.status_code == 200

    # 3. Cek katalog aktif (menu tidak boleh muncul)
    res_active = client_with_admin.get("/api/v1/kasir/menu/")
    assert res_active.status_code == 200
    active_ids = [m["id"] for m in res_active.get_json()["data"]]
    assert menu_id not in active_ids

    # 4. Cek endpoint arsip (menu HARUS muncul)
    res_archived = client_with_admin.get("/api/v1/kasir/menu/archived")
    assert res_archived.status_code == 200
    archived_list = res_archived.get_json()["data"]
    archived_item = next((m for m in archived_list if m["id"] == menu_id), None)
    assert archived_item is not None
    assert archived_item["nama"] == "Kopi Susu Gula Aren"
    assert archived_item["is_active"] is False


def test_restore_menu_endpoint(client_with_admin):
    """Memastikan endpoint restore mengembalikan menu dari arsip ke katalog aktif."""
    # 1. Buat dan arsipkan menu
    res_create = client_with_admin.post("/api/v1/kasir/menu/", json={
        "nama": "Teh Manis Dingin Jumbo",
        "harga": 5000,
        "stok": 100
    })
    menu_id = res_create.get_json()["data"]["id"]
    client_with_admin.delete(f"/api/v1/kasir/menu/{menu_id}")

    # 2. Restore menu
    res_restore = client_with_admin.post(f"/api/v1/kasir/menu/{menu_id}/restore")
    assert res_restore.status_code == 200
    assert res_restore.get_json()["success"] is True

    # 3. Cek katalog aktif (harus muncul kembali)
    res_active = client_with_admin.get("/api/v1/kasir/menu/")
    active_ids = [m["id"] for m in res_active.get_json()["data"]]
    assert menu_id in active_ids

    # 4. Cek katalog arsip (sudah tidak boleh ada di arsip)
    res_archived = client_with_admin.get("/api/v1/kasir/menu/archived")
    archived_ids = [m["id"] for m in res_archived.get_json()["data"]]
    assert menu_id not in archived_ids
