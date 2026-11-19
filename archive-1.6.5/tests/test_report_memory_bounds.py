import datetime as dt

import pytest

from app import create_app, db
from app.models import Grup, MaintenanceTicket, PC, User


@pytest.fixture
def ctx():
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
    })
    with app.app_context():
        db.create_all()
        admin = User(username="admin_bounds", nama_lengkap="Admin", role="admin")
        admin.set_password("pass123")
        grup = Grup(nama="reguler", warna="#888888")
        db.session.add_all([admin, grup])
        db.session.flush()
        pc = PC(kode="TM-01", nama="TM-01", grup_id=grup.id, aktif=True)
        db.session.add(pc)
        db.session.flush()
        for i in range(7):
            db.session.add(MaintenanceTicket(
                pc_id=pc.id, reporter="tester", kategori="HARDWARE", prioritas="SEDANG",
                judul=f"Rusak {i}", status="SELESAI", biaya=10000,
                created_at=dt.datetime(2026, 1, 4, 10, 0),
                resolved_at=dt.datetime(2026, 1, 5, 10, 0),
            ))
        db.session.commit()
        yield app, admin


def _client(app, admin):
    client = app.test_client()
    with client.session_transaction() as sess:
        sess["kasir_id"] = admin.id
        sess["kasir_username"] = admin.username
        sess["kasir_role"] = admin.role
    return client


def test_uptime_tujuh_hari_lebih_ditolak(ctx, monkeypatch):
    app, admin = ctx
    monkeypatch.setattr("app.routes.hardware.uptime_routes.UptimeService.get_range_report", lambda *a: {})
    resp = _client(app, admin).get("/api/v1/kasir/uptime/range?start=2026-01-01&end=2027-01-02")
    assert resp.status_code == 400


def test_uptime_366_hari_diterima(ctx, monkeypatch):
    app, admin = ctx
    monkeypatch.setattr("app.routes.hardware.uptime_routes.UptimeService.get_range_report", lambda *a: {"success": True})
    resp = _client(app, admin).get("/api/v1/kasir/uptime/range?start=2026-01-01&end=2027-01-01")
    assert resp.status_code == 200


def test_maintenance_pagination_server_side(ctx):
    app, admin = ctx
    client = _client(app, admin)
    halaman_1 = client.get("/api/v1/kasir/maintenance/report?page=1").get_json()["report"]
    halaman_2 = client.get("/api/v1/kasir/maintenance/report?page=2").get_json()["report"]

    assert len(halaman_1["list_tiket"]) == 5
    assert len(halaman_2["list_tiket"]) == 2
    assert halaman_1["total_kasus"] == 7
    assert halaman_2["total_kasus"] == 7
    assert halaman_1["pagination"] == {"page": 1, "per_page": 5, "total": 7, "pages": 2}
    assert halaman_1["pc_paling_sering_rusak"] == [{"pc_kode": "TM-01", "jumlah": 7}]


def test_export_csv_memuat_semua_tiket(ctx):
    app, admin = ctx
    resp = _client(app, admin).get("/api/v1/kasir/maintenance/export")
    assert resp.status_code == 200
    assert resp.mimetype == "text/csv"
    assert len([b for b in resp.data.decode().strip().splitlines() if b]) == 8
