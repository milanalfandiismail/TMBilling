from app import create_app, db
from app.models import User


def test_download_db_memakai_database_aktif(tmp_path):
    db_path = tmp_path / "aktif.db"
    app = create_app({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{db_path.as_posix()}",
    })
    with app.app_context():
        db.create_all()
        db.session.execute(db.text("CREATE TABLE penanda (isi TEXT)"))
        db.session.execute(db.text("INSERT INTO penanda (isi) VALUES ('MARKER_ALAMAT')"))
        admin = User(username="admin_download", nama_lengkap="Admin", role="admin")
        admin.set_password("pass123")
        db.session.add(admin)
        db.session.commit()
        admin_id = admin.id

    client = app.test_client()
    with client.session_transaction() as sess:
        sess["kasir_id"] = admin_id
        sess["kasir_role"] = "admin"

    resp = client.get("/api/v1/kasir/settings/backup/download")
    assert resp.status_code == 200
    assert resp.data.startswith(b"SQLite format 3")
    assert b"MARKER_ALAMAT" in resp.data
