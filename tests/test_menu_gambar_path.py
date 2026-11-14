import pytest

from app.services.menu.menu_service import MenuService


def test_path_luar_ditolak_saat_create():
    with pytest.raises(ValueError, match="Path gambar menu tidak valid"):
        MenuService.create_menu({"nama": "Es Teh", "harga": 5000, "stok": 10, "gambar_path": "https://evil.example/x.png"})


def test_path_kosong_diterima():
    assert MenuService._validate_gambar_path(None) is None
    assert MenuService._validate_gambar_path("") is None


def test_path_statis_diterima():
    assert MenuService._validate_gambar_path("/static/uploads/menu/es_teh.png") == "/static/uploads/menu/es_teh.png"

