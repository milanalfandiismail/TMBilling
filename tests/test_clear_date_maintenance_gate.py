from app import create_app
from app.models import db, User
from app.services import ReportService
from app.services import maintenance_mode


def _app_dan_client(tmp_path):
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///" + str(tmp_path / "gate.db"),
    })
    with app.app_context():
        db.create_all()
        admin = User(username="admin_gate", nama_lengkap="Admin", role="admin", aktif=True)
        admin.set_password("rahasia")
        db.session.add(admin)
        db.session.commit()
        admin_id = admin.id

    client = app.test_client()
    with client.session_transaction() as sesi:
        sesi["kasir_id"] = admin_id
        sesi["kasir_username"] = "admin_gate"
        sesi["kasir_role"] = "admin"
    return app, client


def test_hapus_tanggal_mengaktifkan_gerbang_maintenance(tmp_path, monkeypatch):
    app, client = _app_dan_client(tmp_path)
    terlihat = {}

    def clear_palsu(tanggal, operator="system"):
        terlihat["aktif"] = maintenance_mode.is_active()
        return True

    monkeypatch.setattr(ReportService, "clear_transactions_by_date", staticmethod(clear_palsu))

    res = client.delete("/api/v1/kasir/report/transaksi/by-date/2026-01-01")

    assert res.status_code == 200
    assert terlihat["aktif"] is True
    assert maintenance_mode.is_active() is False


def test_gerbang_dilepas_walau_hapus_gagal(tmp_path, monkeypatch):
    app, client = _app_dan_client(tmp_path)

    def clear_gagal(tanggal, operator="system"):
        raise RuntimeError("gagal hapus")

    monkeypatch.setattr(ReportService, "clear_transactions_by_date", staticmethod(clear_gagal))

    res = client.delete("/api/v1/kasir/report/transaksi/by-date/2026-01-01")

    assert res.status_code == 500
    assert maintenance_mode.is_active() is False
