# tests/test_image_deletion.py
"""Test suite untuk memvalidasi penghapusan file fisik gambar saat Hapus/Ganti atau Hard Delete pada Menu & Game."""

import os
import io
import pytest
from flask import current_app
from app import create_app
from app.models import MenuItem
from app.models.game.game import Game
from app.services import MenuService
from app.services.game.game_service import GameService


@pytest.fixture
def app_instance():
    app = create_app()
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False
    yield app


@pytest.fixture
def client(app_instance):
    with app_instance.test_client() as client:
        with client.session_transaction() as sess:
            sess["kasir_id"] = 1
            sess["kasir_role"] = "admin"
            sess["kasir_username"] = "admin"
        yield client


def test_menu_image_physical_deletion_on_hapus_gambar(app_instance, client):
    """Memastikan file fisik gambar menu di disk terhapus saat hapus_gambar=true dikirim."""
    with app_instance.app_context():
        # Buat dummy menu file
        upload_dir = os.path.join(current_app.root_path, "static", "uploads", "menu")
        os.makedirs(upload_dir, exist_ok=True)
        dummy_filename = "test_menu_dummy_image.jpg"
        dummy_path = os.path.join(upload_dir, dummy_filename)
        with open(dummy_path, "wb") as f:
            f.write(b"fake image data")
        assert os.path.exists(dummy_path)

        menu = MenuItem(nama="Kopi Susu Gula Aren", harga=12000, stok=10, gambar_path=f"/static/uploads/menu/{dummy_filename}")
        from app.models import db
        db.session.add(menu)
        db.session.commit()
        menu_id = menu.id

    # Update menu dengan hapus_gambar = "true" via FormData
    res = client.put(f"/api/v1/kasir/menu/{menu_id}", data={
        "nama": "Kopi Susu Gula Aren",
        "hapus_gambar": "true"
    })
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["gambar_path"] is None

    # Verifikasi file fisik sudah tidak ada di disk
    assert not os.path.exists(dummy_path)

    # Cleanup menu
    with app_instance.app_context():
        item = MenuItem.query.get(menu_id)
        if item:
            MenuService.hard_delete_menu(item.id, operator="test")


def test_menu_image_physical_deletion_on_hard_delete(app_instance):
    """Memastikan file fisik gambar menu di disk terhapus saat hard_delete_menu dipanggil."""
    with app_instance.app_context():
        upload_dir = os.path.join(current_app.root_path, "static", "uploads", "menu")
        os.makedirs(upload_dir, exist_ok=True)
        dummy_filename = "test_menu_delete_perm.jpg"
        dummy_path = os.path.join(upload_dir, dummy_filename)
        with open(dummy_path, "wb") as f:
            f.write(b"fake image data")
        assert os.path.exists(dummy_path)

        menu = MenuItem(nama="Roti Bakar Coklat Keju", harga=15000, stok=5, gambar_path=f"/static/uploads/menu/{dummy_filename}")
        from app.models import db
        db.session.add(menu)
        db.session.commit()
        menu_id = menu.id

        # Hard delete
        MenuService.hard_delete_menu(menu_id, operator="test")
        assert not os.path.exists(dummy_path)


def test_game_icon_physical_deletion_on_hapus_icon(app_instance, client):
    """Memastikan file fisik icon cover game terhapus saat hapus_icon=true dikirim."""
    with app_instance.app_context():
        upload_dir = os.path.join("app", "static", "uploads", "games")
        os.makedirs(upload_dir, exist_ok=True)
        dummy_filename = "test_game_cover.jpg"
        dummy_path = os.path.join(upload_dir, dummy_filename)
        with open(dummy_path, "wb") as f:
            f.write(b"fake icon data")
        assert os.path.exists(dummy_path)

        game = Game(nama="Test Game Deletion", tipe="game", kategori="Action", icon=dummy_filename, aktif=True)
        from app.repositories.game.game_repository import GameRepository
        GameRepository.add(game)
        game_id = game.id

    # Update game dengan hapus_icon="true"
    res = client.post(f"/api/v1/kasir/game/{game_id}", data={
        "nama": "Test Game Deletion",
        "hapus_icon": "true"
    })
    assert res.status_code == 200
    assert not os.path.exists(dummy_path)

    # Cleanup game
    with app_instance.app_context():
        GameService.delete(game_id, operator="test")
