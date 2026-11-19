from datetime import datetime, timedelta
import app.utils.timezone_utils as tz
from app import create_app, db
from app.models import Grup, PC, Sesi, User
from app.services.settings.settings_service import SettingsService
from app.utils.timezone_utils import get_local_date_range_utc, get_today_local_date

# UTC 16:16 WITA sudah tanggal berikutnya di Asia/Makassar (UTC+8).
FREEZE_UTC = datetime(2026, 11, 11, 16, 16, 12)


def test_clear_date_with_active_session_returns_400(monkeypatch):
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
                      "SECRET_KEY": "test-clear-date", "WTF_CSRF_ENABLED": False})
    with app.app_context():
        SettingsService.set("timezone", "Asia/Makassar")
        monkeypatch.setattr(tz, "now_utc", lambda: FREEZE_UTC)

        db.create_all()
        grup = Grup(nama="reguler")
        u = User(username="adminr", nama_lengkap="Admin", role="admin", aktif=True)
        u.set_password("x")
        db.session.add_all([grup, u]); db.session.flush()
        pc = PC(kode="PC-01", nama="PC-01", ip_address="10.0.0.1", grup_id=grup.id, aktif=True)
        db.session.add(pc); db.session.flush()
        target = get_today_local_date() - timedelta(days=1)
        start_utc, _end_utc = get_local_date_range_utc(target.isoformat())
        db.session.add(Sesi(pc_id=pc.id, tipe="guest", status="aktif",
                            durasi_beli_menit=60, mulai_pada=start_utc + timedelta(hours=12)))
        db.session.commit()
        client = app.test_client()
        with client.session_transaction() as s:
            s["kasir_id"] = u.id; s["kasir_username"] = "adminr"; s["kasir_role"] = "admin"
        res = client.delete(f"/api/v1/kasir/report/transaksi/by-date/{target.isoformat()}")
        assert res.status_code == 400
