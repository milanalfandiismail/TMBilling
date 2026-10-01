# tests/test_game_and_menu_rbac_restock.py
"""Test suite untuk RBAC Kelola Game, RBAC Arsip Menu, dan Fitur Penambahan Stok Menu (Restock & Audit Log)."""

import pytest
from app import create_app
from app.models import db, User, MenuItem, ShiftRecord
from app.services import MenuService
from app.utils.logger import read_logs, normalize_legacy_log_line
from app.utils.timezone_utils import now_utc


@pytest.fixture
def client_admin():
    app = create_app()
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False

    with app.test_client() as client:
        with client.session_transaction() as sess:
            sess["kasir_id"] = 1
            sess["kasir_role"] = "admin"
            sess["kasir_username"] = "admin"
        yield client


@pytest.fixture
def client_kasir():
    app = create_app()
    app.config["TESTING"] = True
    app.config["WTF_CSRF_ENABLED"] = False

    with app.app_context():
        kasir_user = User.query.filter_by(username="kasir_test_rbac").first()
        if not kasir_user:
            kasir_user = User(username="kasir_test_rbac", role="kasir")
            kasir_user.set_password("123456")
            db.session.add(kasir_user)
            db.session.commit()
        kasir_id = kasir_user.id

        # Pastikan tidak ada shift aktif yang tertinggal
        active_shifts = ShiftRecord.query.filter_by(kasir_id=kasir_id, status="AKTIF").all()
        for s in active_shifts:
            s.status = "SELESAI"
            s.waktu_selesai = now_utc()
        db.session.commit()

    with app.test_client() as client:
        with client.session_transaction() as sess:
            sess["kasir_id"] = kasir_id
            sess["kasir_role"] = "kasir"
            sess["kasir_username"] = "kasir_test_rbac"
        yield client

    with app.app_context():
        active_shifts = ShiftRecord.query.filter_by(kasir_id=kasir_id, status="AKTIF").all()
        for s in active_shifts:
            s.status = "SELESAI"
            s.waktu_selesai = now_utc()
        db.session.commit()


def test_game_management_kasir_blocked(client_kasir):
    """Memastikan kasir dilarang mengakses API kelola game & kategori."""
    # 1. GET /api/v1/kasir/game/ -> 403 Forbidden
    res_games = client_kasir.get("/api/v1/kasir/game/")
    assert res_games.status_code == 403

    # 2. GET /api/v1/kasir/game/kategori -> 403 Forbidden
    res_kategori = client_kasir.get("/api/v1/kasir/game/kategori")
    assert res_kategori.status_code == 403


def test_game_management_admin_allowed(client_admin):
    """Memastikan admin dapat mengakses API kelola game & kategori."""
    # 1. GET /api/v1/kasir/game/ -> 200 OK
    res_games = client_admin.get("/api/v1/kasir/game/")
    assert res_games.status_code == 200
    assert res_games.get_json()["success"] is True

    # 2. GET /api/v1/kasir/game/kategori -> 200 OK
    res_kategori = client_admin.get("/api/v1/kasir/game/kategori")
    assert res_kategori.status_code == 200
    assert res_kategori.get_json()["success"] is True


def test_menu_archive_kasir_blocked(client_kasir):
    """Memastikan kasir dilarang mengakses API arsip menu."""
    res_archived = client_kasir.get("/api/v1/kasir/menu/archived")
    assert res_archived.status_code == 403


def test_menu_archive_admin_allowed(client_admin):
    """Memastikan admin dapat mengakses API arsip menu."""
    res_archived = client_admin.get("/api/v1/kasir/menu/archived")
    assert res_archived.status_code == 200
    assert res_archived.get_json()["success"] is True


def test_menu_crud_rbac_kasir_blocked(client_kasir):
    """Memastikan kasir dilarang melakukan Create, Update, Delete, Restore menu."""
    app = create_app()
    with app.app_context():
        item = MenuItem.query.filter_by(nama="Kerupuk Kaleng RBAC").first()
        if not item:
            item = MenuItem(nama="Kerupuk Kaleng RBAC", harga=2000, stok=20)
            db.session.add(item)
            db.session.commit()
        item_id = item.id

    # 1. Kasir dilarang Create
    res_create = client_kasir.post("/api/v1/kasir/menu/", json={"nama": "Es Campur RBAC", "harga": 8000, "stok": 10})
    assert res_create.status_code == 403

    # 2. Kasir dilarang Update nama/harga
    res_update = client_kasir.put(f"/api/v1/kasir/menu/{item_id}", json={"nama": "Kerupuk Kaleng Edit", "harga": 3000})
    assert res_update.status_code == 403

    # 3. Kasir dilarang Delete (Arsip)
    res_del = client_kasir.delete(f"/api/v1/kasir/menu/{item_id}")
    assert res_del.status_code == 403

    # 4. Kasir dilarang Restore
    res_restore = client_kasir.post(f"/api/v1/kasir/menu/{item_id}/restore")
    assert res_restore.status_code == 403

    # 5. Kasir dilarang Hard Delete
    res_hard = client_kasir.delete(f"/api/v1/kasir/menu/{item_id}/permanent")
    assert res_hard.status_code == 403

    # Cleanup
    with app.app_context():
        clean_item = MenuItem.query.filter_by(nama="Kerupuk Kaleng RBAC").first()
        if clean_item:
            MenuService.hard_delete_menu(clean_item.id, operator="cleanup")


def test_tambah_stok_menu_flow_and_audit_logging(client_kasir):
    """Memastikan fitur penambahan stok (restock) berjalan dengan benar untuk kasir serta mencatat log audit."""
    app = create_app()
    with app.app_context():
        item = MenuItem.query.filter_by(nama="Pop Mie Pedas RBAC").first()
        if not item:
            item = MenuItem(nama="Pop Mie Pedas RBAC", harga=7000, stok=15)
            db.session.add(item)
            db.session.commit()
        menu_id = item.id

        unlimited_item = MenuItem.query.filter_by(nama="Air Mineral Unlimited RBAC").first()
        if not unlimited_item:
            unlimited_item = MenuItem(nama="Air Mineral Unlimited RBAC", harga=3000, stok=-1)
            db.session.add(unlimited_item)
            db.session.commit()
        unlimited_id = unlimited_item.id

    # 1. Kasir belum buka shift mencoba tambah stok -> Ditolak (400: Shift kasir belum dibuka)
    res_no_shift = client_kasir.post(f"/api/v1/kasir/menu/{menu_id}/tambah-stok", json={"jumlah_tambah": 10})
    assert res_no_shift.status_code == 400
    assert "shift" in res_no_shift.get_json()["error"].lower()

    # 2. Kasir membuka shift
    res_buka_shift = client_kasir.post("/api/v1/kasir/shift/start", json={"modal_awal": 50000})
    assert res_buka_shift.status_code == 201

    # 3. Kasir mencoba tambah stok dengan jumlah invalid (<= 0 atau string) -> 400 Bad Request
    res_invalid_1 = client_kasir.post(f"/api/v1/kasir/menu/{menu_id}/tambah-stok", json={"jumlah_tambah": 0})
    assert res_invalid_1.status_code == 400

    res_invalid_2 = client_kasir.post(f"/api/v1/kasir/menu/{menu_id}/tambah-stok", json={"jumlah_tambah": "abc"})
    assert res_invalid_2.status_code == 400

    # 4. Kasir mencoba tambah stok pada item unlimited -> Ditolak
    res_unlimited = client_kasir.post(f"/api/v1/kasir/menu/{unlimited_id}/tambah-stok", json={"jumlah_tambah": 10})
    assert res_unlimited.status_code == 400
    assert "unlimited" in res_unlimited.get_json()["error"].lower()

    # 5. Kasir berhasil menambah stok sebanyak +25
    res_success_kasir = client_kasir.post(f"/api/v1/kasir/menu/{menu_id}/tambah-stok", json={
        "jumlah_tambah": 25,
        "catatan": "Beli dari Agen Sembako Makmur"
    })
    assert res_success_kasir.status_code == 200
    data = res_success_kasir.get_json()["data"]
    assert data["stok"] == 40  # 15 + 25

    # 6. Verifikasi Log Aktivitas Audit tercatat di log file
    raw_logs = read_logs(limit=50)
    parsed_logs = [normalize_legacy_log_line(line) for line in raw_logs]
    restock_logs = [log for log in parsed_logs if log.get("action") == "RESTOCK_MENU"]
    assert len(restock_logs) >= 1

    kasir_log = restock_logs[0]
    assert kasir_log["user"] == "kasir_test_rbac"
    assert "Pop Mie Pedas RBAC" in kasir_log["detail"]
    assert "+25" in kasir_log["detail"]
    assert kasir_log["detail_json"]["stok_lama"] == 15
    assert kasir_log["detail_json"]["stok_baru"] == 40
    # 7. Verifikasi record tercatat di tabel MenuStockLog & Endpoint GET /api/v1/kasir/menu/stock-logs
    res_stock_logs = client_kasir.get("/api/v1/kasir/menu/stock-logs")
    assert res_stock_logs.status_code == 200
    res_json = res_stock_logs.get_json()
    assert res_json["success"] is True
    assert len(res_json["data"]) >= 1
    
    first_log = res_json["data"][0]
    assert first_log["menu_nama"] == "Pop Mie Pedas RBAC"
    assert first_log["jumlah_masuk"] == 25
    assert first_log["stok_sebelum"] == 15
    assert first_log["stok_sesudah"] == 40
    assert first_log["operator"] == "kasir_test_rbac"
    assert first_log["catatan"] == "Beli dari Agen Sembako Makmur"
    assert "kasir_test_rbac" in res_json["operators"]

    # Filter by search
    res_search = client_kasir.get("/api/v1/kasir/menu/stock-logs?search=Sembako")
    assert res_search.status_code == 200
    assert len(res_search.get_json()["data"]) >= 1

    # Filter by non-matching search
    res_empty = client_kasir.get("/api/v1/kasir/menu/stock-logs?search=NonExistentKeywordXYZ")
    assert res_empty.status_code == 200
    assert len(res_empty.get_json()["data"]) == 0

    # Cleanup
    with app.app_context():
        MenuService.hard_delete_menu(menu_id, operator="cleanup")
        MenuService.hard_delete_menu(unlimited_id, operator="cleanup")
