from app import create_app, db
from app.models import Grup, PC


def test_non_numeric_metric_returns_400():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
                      "SECRET_KEY": "test-hw-metric", "CLIENT_API_KEY": "k"})
    with app.app_context():
        db.create_all()
        g = Grup(nama="reguler"); db.session.add(g); db.session.flush()
        db.session.add(PC(kode="PC-01", nama="PC-01", ip_address="10.0.0.1", grup_id=g.id, aktif=True))
        db.session.commit()
        res = app.test_client().post(
            "/api/v1/public/monitor/",
            json={"CpuUsage": "bukan-angka"},
            headers={"X-Client-Key": "k"},
            environ_base={"REMOTE_ADDR": "10.0.0.1"},
        )
        assert res.status_code == 400
