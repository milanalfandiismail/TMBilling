from app import create_app, db
from app.models import Grup, PC


def test_uninstall_token_uses_forwarded_peer_when_local_proxy():
    app = create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
                      "SECRET_KEY": "test-uninstall", "CLIENT_API_KEY": "k"})
    with app.app_context():
        db.create_all()
        g = Grup(nama="reguler"); db.session.add(g); db.session.flush()
        db.session.add(PC(kode="PC-01", nama="PC-01", ip_address="10.0.0.1", grup_id=g.id, aktif=True))
        db.session.commit()
        res = app.test_client().get(
            "/api/v1/kasir/settings/uninstall-token/client",
            headers={"X-Client-Key": "k", "X-Forwarded-For": "10.0.0.1"},
            environ_base={"REMOTE_ADDR": "127.0.0.1"},
        )
        assert res.status_code == 200
