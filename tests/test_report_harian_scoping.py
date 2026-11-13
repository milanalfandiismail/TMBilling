from app import create_app
from app.models import User, db
from app.repositories import MenuRepository, TransaksiRepository
from app.services.report.report_service import ReportService


def _app():
    app = create_app({"TESTING": True, "WTF_CSRF_ENABLED": False,
                      "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app.app_context():
        user = User(username="kasir1", nama_lengkap="Kasir", role="kasir", aktif=True,
                    password_hash="x")
        db.session.add(user)
        db.session.commit()
    return app


def test_laporan_harian_meneruskan_kasir_id_ke_repo(monkeypatch):
    seen = {}

    def billing(tanggal=None, kasir_id=None):
        seen["billing"] = kasir_id
        return 1000

    def kantin(date_obj=None, kasir_id=None, metode_pembayaran=None):
        seen["kantin"] = kasir_id
        return 500

    app = _app()
    with app.app_context():
        monkeypatch.setattr(TransaksiRepository, "get_total_pendapatan_hari_ini", staticmethod(billing))
        monkeypatch.setattr(MenuRepository, "get_total_pemasukan_by_date", staticmethod(kantin))
        hasil = ReportService.get_laporan_harian(kasir_id=7)

    assert seen == {"billing": 7, "kantin": 7}
    assert hasil["total_pendapatan"] == 1500


def test_route_laporan_harian_mengunci_kasir_ke_dirinya(monkeypatch):
    seen = {}
    app = _app()
    with app.app_context():
        user_id = User.query.filter_by(username="kasir1").first().id
    with app.test_client() as client:
        with client.session_transaction() as sess:
            sess["kasir_id"] = user_id
            sess["kasir_username"] = "kasir1"
            sess["kasir_role"] = "kasir"
        monkeypatch.setattr(
            ReportService, "get_laporan_harian",
            staticmethod(lambda kasir_id=None: seen.update({"kasir_id": kasir_id}) or {"total_pendapatan": 0}))
        resp = client.get("/api/v1/kasir/report/laporan-harian")

    assert resp.status_code == 200
    assert seen == {"kasir_id": user_id}
