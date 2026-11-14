from datetime import datetime

import pytest

from app import create_app
from app.models import db, Transaksi, User
from app.services import SettingsService
from app.services.owner.analytics_service import OwnerAnalyticsService


@pytest.fixture
def app(tmp_path):
    application = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///" + (tmp_path / "warnet.db").as_posix(),
        "INSTANCE_PATH": str(tmp_path / "instance"),
    })
    with application.app_context():
        db.create_all()
        SettingsService.set("timezone", "Asia/Makassar")
        # WITA = UTC+8: 23:59:59.5 lokal tanggal 14 = 15:59:59.5 UTC.
        db.session.add_all([
            Transaksi(jenis="beli_paket_guest", jumlah=1000, dibuat_pada=datetime(2026, 11, 14, 15, 59, 59, 500000)),
            Transaksi(jenis="beli_paket_guest", jumlah=2000, dibuat_pada=datetime(2026, 11, 14, 16, 0, 0)),
        ])
        db.session.commit()
    return application


def test_transaksi_pecahan_detik_terakhir_masuk_hari_terpilih(app):
    with app.app_context():
        data = OwnerAnalyticsService.get_all_analytics("2026-11-14", "2026-11-14")
        pendapatan = data["pendapatan_harian"]
        assert pendapatan["labels"] == ["14/11/2026"]
        assert pendapatan["billing"] == [1000]


def test_tanggal_terbalik_ditolak(app):
    with app.app_context():
        with pytest.raises(ValueError, match="sebelum tanggal akhir"):
            OwnerAnalyticsService.get_all_analytics("2026-11-15", "2026-11-14")


def test_rentang_lebih_dari_366_hari_ditolak(app):
    with app.app_context():
        with pytest.raises(ValueError, match="366"):
            OwnerAnalyticsService.get_all_analytics("2026-01-01", "2027-01-02")
        assert OwnerAnalyticsService.get_all_analytics("2026-01-01", "2027-01-01")


def test_route_analytics_menolak_rentang_terbalik(app):
    with app.app_context():
        admin = User(username="owner_admin", nama_lengkap="Admin", role="admin", aktif=True)
        admin.set_password("rahasia123")
        db.session.add(admin)
        db.session.commit()
        admin_id = admin.id

    client = app.test_client()
    with client.session_transaction() as sess:
        sess["kasir_id"] = admin_id
        sess["kasir_role"] = "admin"
        sess["kasir_username"] = "owner_admin"

    res = client.get("/api/v1/kasir/dashboard/analytics?start=2026-11-15&end=2026-11-14")

    assert res.status_code == 400
    assert "sebelum tanggal akhir" in res.get_json()["error"]

